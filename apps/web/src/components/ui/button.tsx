import { Link, type LinkProps as TanstackLinkProps } from "@tanstack/solid-router";
import { cva, type VariantProps } from "cva";
import type { JSX } from "solid-js";

interface ButtonProps extends BaseProps {
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
}

interface InternalLinkProps extends BaseProps {
  to: TanstackLinkProps["to"];
  hash?: string;
  onClick?: () => void;
}

interface LinkProps extends BaseProps {
  href: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  download?: string;
  onClick?: () => void;
}

interface BaseProps extends VariantProps<typeof button> {
  children: JSX.Element;
  class?: string;
}

/** The game's buttons: rounded rects (no pills), mode gradients with a short crisp drop. */
const button = cva({
  base: "inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-[12px] font-bold transition-[filter,background-color] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white",
  variants: {
    intent: {
      primary: "bg-white/10 text-white hover:bg-white/15",
      white: "bg-white text-[#101024] shadow-crisp hover:brightness-95",
      "gradient-sing": "gradient-sing text-white shadow-crisp hover:brightness-110",
      "gradient-party": "gradient-party text-white shadow-crisp hover:brightness-110",
      "gradient-lobby": "gradient-lobby text-white shadow-crisp hover:brightness-110",
      "gradient-settings": "gradient-settings text-white shadow-crisp hover:brightness-110",
    },
    size: {
      sm: "h-10 px-4 text-sm",
      md: "h-12 px-5",
      lg: "h-14 px-6 text-lg",
    },
  },
  defaultVariants: {
    intent: "primary",
    size: "md",
  },
});

export default function Button(props: ButtonProps | InternalLinkProps | LinkProps) {
  const classes = () => `${button({ intent: props.intent, size: props.size })} ${props.class ?? ""}`;

  // oxlint-disable-next-line solid/components-return-once
  return "to" in props ? (
    <Link to={props.to} hash={props.hash} class={classes()} onClick={() => props.onClick?.()}>
      {props.children}
    </Link>
  ) : "href" in props ? (
    <a
      href={props.href}
      target={props.target}
      rel={props.target === "_blank" ? "noopener noreferrer" : undefined}
      class={classes()}
      download={props.download}
      onClick={() => props.onClick?.()}
    >
      {props.children}
    </a>
  ) : (
    <button type={props.type || "button"} onClick={() => props.onClick?.()} class={classes()}>
      {props.children}
    </button>
  );
}
