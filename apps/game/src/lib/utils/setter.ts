/** biome-ignore-all lint/complexity/noBannedTypes: Its fine here */
/** biome-ignore-all lint/suspicious/noExplicitAny: Its fine here */
type PathImpl<T, K extends keyof T> = K extends string
  ? T[K] extends Record<string, any>
    ? T[K] extends ArrayLike<any>
      ? K | `${K}.${PathImpl<T[K], Exclude<keyof T[K], keyof any[]>>}`
      : K | `${K}.${PathImpl<T[K], keyof T[K]>}`
    : K
  : never;

export type Path<T> = PathImpl<T, keyof T> | keyof T;

export type PathValue<T, P extends Path<T>> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends Path<T[K]>
      ? PathValue<T[K], Rest>
      : never
    : never
  : P extends keyof T
    ? T[P]
    : never;

export type NotWrappable = string | number | bigint | symbol | boolean | Function | null | undefined;

type W<T> = Exclude<T, NotWrappable>;

type KeyOf<T> = number extends keyof T
  ? 0 extends 1 & T
    ? keyof T
    : [T] extends [never]
      ? never
      : [T] extends [readonly unknown[]]
        ? number
        : keyof T
  : keyof T;

type MutableKeyOf<T> = KeyOf<T>;

export type NestedSetter<T, U extends PropertyKey[] = []> = T | ((prevState: T, traversed: U) => T);

export type Part<T, K extends KeyOf<T> = KeyOf<T>> = K;

export interface NestedSetterFunction<T> {
  // 7 levels deep (same as createStore)
  <
    K1 extends KeyOf<W<T>>,
    K2 extends KeyOf<W<W<T>[K1]>>,
    K3 extends KeyOf<W<W<W<T>[K1]>[K2]>>,
    K4 extends KeyOf<W<W<W<W<T>[K1]>[K2]>[K3]>>,
    K5 extends KeyOf<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>>,
    K6 extends KeyOf<W<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>[K5]>>,
    K7 extends MutableKeyOf<W<W<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>[K5]>[K6]>>,
  >(
    k1: Part<W<T>, K1>,
    k2: Part<W<W<T>[K1]>, K2>,
    k3: Part<W<W<W<T>[K1]>[K2]>, K3>,
    k4: Part<W<W<W<W<T>[K1]>[K2]>[K3]>, K4>,
    k5: Part<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>, K5>,
    k6: Part<W<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>[K5]>, K6>,
    k7: Part<W<W<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>[K5]>[K6]>, K7>,
    setter: NestedSetter<W<W<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>[K5]>[K6]>[K7], [K7, K6, K5, K4, K3, K2, K1]>,
  ): void;

  // 6 levels deep
  <
    K1 extends KeyOf<W<T>>,
    K2 extends KeyOf<W<W<T>[K1]>>,
    K3 extends KeyOf<W<W<W<T>[K1]>[K2]>>,
    K4 extends KeyOf<W<W<W<W<T>[K1]>[K2]>[K3]>>,
    K5 extends KeyOf<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>>,
    K6 extends MutableKeyOf<W<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>[K5]>>,
  >(
    k1: Part<W<T>, K1>,
    k2: Part<W<W<T>[K1]>, K2>,
    k3: Part<W<W<W<T>[K1]>[K2]>, K3>,
    k4: Part<W<W<W<W<T>[K1]>[K2]>[K3]>, K4>,
    k5: Part<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>, K5>,
    k6: Part<W<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>[K5]>, K6>,
    setter: NestedSetter<W<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>[K5]>[K6], [K6, K5, K4, K3, K2, K1]>,
  ): void;

  // 5 levels deep
  <
    K1 extends KeyOf<W<T>>,
    K2 extends KeyOf<W<W<T>[K1]>>,
    K3 extends KeyOf<W<W<W<T>[K1]>[K2]>>,
    K4 extends KeyOf<W<W<W<W<T>[K1]>[K2]>[K3]>>,
    K5 extends MutableKeyOf<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>>,
  >(
    k1: Part<W<T>, K1>,
    k2: Part<W<W<T>[K1]>, K2>,
    k3: Part<W<W<W<T>[K1]>[K2]>, K3>,
    k4: Part<W<W<W<W<T>[K1]>[K2]>[K3]>, K4>,
    k5: Part<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>, K5>,
    setter: NestedSetter<W<W<W<W<W<T>[K1]>[K2]>[K3]>[K4]>[K5], [K5, K4, K3, K2, K1]>,
  ): void;

  // 4 levels deep
  <
    K1 extends KeyOf<W<T>>,
    K2 extends KeyOf<W<W<T>[K1]>>,
    K3 extends KeyOf<W<W<W<T>[K1]>[K2]>>,
    K4 extends MutableKeyOf<W<W<W<W<T>[K1]>[K2]>[K3]>>,
  >(
    k1: Part<W<T>, K1>,
    k2: Part<W<W<T>[K1]>, K2>,
    k3: Part<W<W<W<T>[K1]>[K2]>, K3>,
    k4: Part<W<W<W<W<T>[K1]>[K2]>[K3]>, K4>,
    setter: NestedSetter<W<W<W<W<T>[K1]>[K2]>[K3]>[K4], [K4, K3, K2, K1]>,
  ): void;

  // 3 levels deep
  <K1 extends KeyOf<W<T>>, K2 extends KeyOf<W<W<T>[K1]>>, K3 extends MutableKeyOf<W<W<W<T>[K1]>[K2]>>>(
    k1: Part<W<T>, K1>,
    k2: Part<W<W<T>[K1]>, K2>,
    k3: Part<W<W<W<T>[K1]>[K2]>, K3>,
    setter: NestedSetter<W<W<W<T>[K1]>[K2]>[K3], [K3, K2, K1]>,
  ): void;

  // 2 levels deep
  <K1 extends KeyOf<W<T>>, K2 extends MutableKeyOf<W<W<T>[K1]>>>(
    k1: Part<W<T>, K1>,
    k2: Part<W<W<T>[K1]>, K2>,
    setter: NestedSetter<W<W<T>[K1]>[K2], [K2, K1]>,
  ): void;

  // 1 level deep
  <K1 extends MutableKeyOf<W<T>>>(k1: Part<W<T>, K1>, setter: NestedSetter<W<T>[K1], [K1]>): void;

  // Root level
  (setter: NestedSetter<T, []>): void;
}

function updateNestedPath(current: any, path: PropertyKey[], value: any): any {
  if (path.length === 0) {
    return typeof value === "function" ? value(current, []) : value;
  }

  const newState = structuredClone(current);
  let target = newState as any;

  // Navigate to parent
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!key || target[key] === undefined) {
      throw new Error(`Invalid path: ${path.join(".")}`);
    }
    target = target[key];
  }

  // Update final property
  const finalKey = path[path.length - 1];
  if (!finalKey) {
    throw new Error("Final key cannot be undefined");
  }

  const prevValue = target[finalKey];

  if (typeof value === "function") {
    target[finalKey] = value(prevValue, [...path].reverse());
  } else {
    target[finalKey] = value;
  }

  return newState;
}

export function createNestedSetter<T>(setter: (updater: (prev: T) => T) => void): NestedSetterFunction<T> {
  function updateNested(...args: any[]): void {
    const valueOrSetter = args[args.length - 1];
    const path = args.slice(0, -1) as PropertyKey[];

    setter((prev) => updateNestedPath(prev, path, valueOrSetter));
  }

  return updateNested as NestedSetterFunction<T>;
}

export function makeNested<T, R extends readonly any[]>(
  signalTuple: readonly [() => T, (value: T | ((prev: T) => T)) => T, ...R],
): readonly [() => T, (value: T | ((prev: T) => T)) => T, NestedSetterFunction<T>, ...R] {
  const [getter, setter, ...rest] = signalTuple;
  const nestedSetter = createNestedSetter<T>((updater) => setter(updater));

  return [getter, setter, nestedSetter, ...rest] as const;
}
