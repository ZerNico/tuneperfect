import { Link, type LinkProps as TanstackLinkProps } from "@tanstack/solid-router";
import { type VariantProps, cva } from "cva";
import type { JSX } from "solid-js";

interface ButtonProps extends BaseProps {
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
}

interface InternalLinkProps extends BaseProps {
  to: TanstackLinkProps["to"];
}

interface LinkProps extends BaseProps {
  href: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  download?: string;
}

interface BaseProps extends VariantProps<typeof button> {
  children: JSX.Element;
  class?: string;
}

const button = cva({
  base: "inline-grid h-10 transform cursor-pointer items-center gap-4 rounded-lg px-6 font-semibold shadow-md transition-all ease-in-out focus:outline-slate-800 active:scale-95",
  variants: {
    intent: {
      primary: "bg-slate-800 text-white hover:bg-slate-700",
      "gradient-sing": "gradient-sing bg-gradient-to-r text-white hover:opacity-90",
      "gradient-settings": "gradient-settings bg-gradient-to-r text-white hover:opacity-90",
      "gradient-lobby": "gradient-lobby bg-gradient-to-r text-white hover:opacity-90",
    },
  },
  defaultVariants: {
    intent: "primary",
  },
});

export default function Button(props: ButtonProps | InternalLinkProps | LinkProps) {
  const classes = () => ({
    [button({ intent: props.intent })]: true,
    [props.class || ""]: true,
  });

  if ("to" in props) {
    return (
      <Link to={props.to} classList={classes()}>
        <ButtonContent>{props.children}</ButtonContent>
      </Link>
    );
  }

  if ("href" in props) {
    return (
      <a href={props.href} target={props.target} classList={classes()} download={props.download}>
        <ButtonContent>{props.children}</ButtonContent>
      </a>
    );
  }
  
  return (
    <button type={props.type || "button"} onClick={props.onClick} classList={classes()}>
      <ButtonContent>{props.children}</ButtonContent>
    </button>
  );
}

function ButtonContent(props: { children: JSX.Element }) {
  return (
    <>
      <span class="col-start-1 row-start-1 flex items-center justify-center gap-2 transition-opacity">{props.children}</span>
    </>
  );
}
