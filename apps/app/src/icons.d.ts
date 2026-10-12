// unplugin-icons ships Solid 1 types (`JSX` from `solid-js`); Solid 2 moved JSX types to `@solidjs/web`.
declare module "~icons/*" {
  import type { ComponentProps, JSX } from "@solidjs/web";

  const component: (props: ComponentProps<"svg">) => JSX.Element;
  export default component;
}
