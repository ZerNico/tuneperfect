import { Link, type LinkProps as TanstackLinkProps } from "@tanstack/solid-router";
import { cva, type VariantProps } from "cva";
import { type JSX, Show } from "solid-js";
import LoaderCircle from "~icons/ph/circle-notch-bold";

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
  base: "inline-grid h-12 cursor-pointer items-center rounded-[12px] px-6 font-bold transition-[scale,background-color,opacity] select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
  variants: {
    intent: {
      /** Quiet secondary action on the dark background. */
      primary: "bg-white/10 text-white hover:bg-white/15",
      /** The screen's main action, in the section's colours. */
      gradient: "gradient-accent text-white hover:opacity-90",
      danger: "bg-red-500 text-white hover:bg-red-600",
      white: "bg-white text-slate-900 hover:bg-slate-100",
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

  // oxlint-disable-next-line solid/components-return-once
  return "to" in props ? (
    <Link to={props.to} classList={classes()} ref={props.ref}>
      <ButtonContent loading={props.loading}>{props.children}</ButtonContent>
    </Link>
  ) : (
    <button
      type={props.type || "button"}
      onClick={() => props.onClick?.()}
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
        class="col-start-1 row-start-1 flex items-center justify-center gap-2"
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
