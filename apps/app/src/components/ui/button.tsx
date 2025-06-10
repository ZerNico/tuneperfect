import { Link, type LinkProps as TanstackLinkProps } from "@tanstack/solid-router";
import { cva, type VariantProps } from "cva";
import { type JSX, Show } from "solid-js";
import LoaderCircle from "~icons/lucide/loader-circle";

interface ButtonProps extends BaseProps {
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
  ref?: HTMLButtonElement;
}

interface LinkProps extends BaseProps {
  to: TanstackLinkProps["to"];
  ref?: HTMLAnchorElement;
}

interface BaseProps extends VariantProps<typeof button> {
  children: JSX.Element;
  class?: string;
  loading?: boolean;
}

const button = cva({
  base: "inline-grid h-10 transform cursor-pointer items-center gap-4 rounded-lg px-6 font-semibold shadow-md transition-all ease-in-out focus:outline-slate-800 active:scale-95",
  variants: {
    intent: {
      primary: "bg-slate-800 text-white hover:bg-slate-700",
      gradient: "bg-gradient-to-r from-cyan-400 to-blue-500 text-white hover:opacity-90",
      danger: "bg-red-500 text-white hover:bg-red-600",
      white: "bg-white text-slate-800 hover:bg-slate-100",
    },
  },
  defaultVariants: {
    intent: "primary",
  },
});

export default function Button(props: ButtonProps | LinkProps) {
  const classes = () => ({
    [button({ intent: props.intent })]: true,
    [props.class || ""]: true,
  });

  if ("to" in props) {
    return (
      <Link to={props.to} classList={classes()} ref={props.ref}>
        <ButtonContent loading={props.loading}>{props.children}</ButtonContent>
      </Link>
    );
  }

  return (
    <button
      type={props.type || "button"}
      onClick={props.onClick}
      classList={classes()}
      disabled={props.disabled}
      ref={props.ref}
    >
      <ButtonContent loading={props.loading}>{props.children}</ButtonContent>
    </button>
  );
}

function ButtonContent(props: { children: JSX.Element; loading?: boolean }) {
  return (
    <>
      <span
        class="col-start-1 row-start-1 flex items-center justify-center gap-2 transition-opacity"
        classList={{
          "opacity-0": props.loading,
        }}
      >
        {props.children}
      </span>
      <Show when={props.loading}>
        <div class="col-start-1 row-start-1 flex items-center justify-center">
          <LoaderCircle class="animate-spin" />
        </div>
      </Show>
    </>
  );
}
