/**
 * Minimal Solid 2 binding for `@tanstack/form-core`, shaped like `@tanstack/solid-form` (`createForm`, `form.Field`,
 * `form.Subscribe`) so the routes can switch back with an import change once TanStack ships a Solid 2 adapter.
 */
import {
  type DeepKeys,
  type DeepValue,
  FieldApi,
  FormApi,
  type FormOptions,
  type FormState,
  functionalUpdate,
} from "@tanstack/form-core";
import { type Accessor, createRenderEffect, createSignal, type Element, onCleanup, onSettled, untrack } from "solid-js";

export { revalidateLogic } from "@tanstack/form-core";

type Source<T> = {
  get: () => T;
  subscribe: (listener: (value: T) => void) => { unsubscribe: () => void };
};

function useSelector<T, TSelected>(source: Source<T>, selector: (state: T) => TSelected): Accessor<TSelected> {
  // Store listeners can fire while Solid is updating (e.g. `api.update` below), so this bridge signal opts into owned writes.
  // Boxed, so a selected function isn't mistaken for a derived signal or an updater.
  const [value, setValue] = createSignal({ current: selector(source.get()) }, { ownedWrite: true });
  const { unsubscribe } = source.subscribe((state) => setValue({ current: selector(state) }));
  onCleanup(unsubscribe);
  return () => value().current;
}

type AnyFormState<TFormData> = FormState<TFormData, any, any, any, any, any, any, any, any, any, any>;

type AnyFormApi<TFormData> = FormApi<TFormData, any, any, any, any, any, any, any, any, any, any, any>;

export type SolidFieldApi<TFormData, TName extends DeepKeys<TFormData>> = FieldApi<
  TFormData,
  TName,
  DeepValue<TFormData, TName>,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

function createField<TFormData, TName extends DeepKeys<TFormData>>(form: AnyFormApi<TFormData>, name: TName) {
  const api = new FieldApi({ form, name }) as SolidFieldApi<TFormData, TName>;
  const [field, setField] = createSignal(api, { equals: false, ownedWrite: true });
  const { unsubscribe } = api.store.subscribe(() => setField(api));
  onCleanup(unsubscribe);
  onSettled(() => api.mount());
  return field;
}

export function createForm<TFormData, TSubmitMeta = never>(
  opts: () => FormOptions<TFormData, any, any, any, any, any, any, any, any, any, any, TSubmitMeta>,
) {
  const api = new FormApi(untrack(opts)) as AnyFormApi<TFormData>;

  // Keep the options current (e.g. default values derived from the URL), like `useRef` in the React adapter.
  createRenderEffect(opts, (options) => api.update(options), { defer: true });
  onSettled(() => api.mount());

  function Field<TName extends DeepKeys<TFormData>>(props: {
    name: TName;
    children: (field: Accessor<SolidFieldApi<TFormData, TName>>) => Element;
  }) {
    const field = createField(
      api,
      untrack(() => props.name),
    );
    return untrack(() => props.children(field));
  }

  function Subscribe<TSelected = AnyFormState<TFormData>>(props: {
    selector?: (state: AnyFormState<TFormData>) => TSelected;
    children: ((state: Accessor<TSelected>) => Element) | Element;
  }) {
    const state = useSelector(api.store, untrack(() => props.selector) ?? ((state) => state as unknown as TSelected));
    return untrack(() => functionalUpdate(props.children, state));
  }

  return Object.assign(api, { Field, Subscribe });
}
