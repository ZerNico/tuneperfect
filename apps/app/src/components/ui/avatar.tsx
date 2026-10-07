import { cva, type VariantProps } from "cva";
import { createEffect, createSignal, on, Show } from "solid-js";
import { joinURL } from "ufo";

import { config } from "~/lib/config";

const avatar = cva({
  base: "grid",
  variants: {
    size: {
      sm: "h-8 w-8 text-xs",
      md: "h-10 w-10",
      lg: "h-30 w-30 text-3xl",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

interface AvatarProps extends VariantProps<typeof avatar> {
  user: {
    image?: string | null;
    username?: string | null;
  };
  class?: string;
}

/** Fallback colours, picked from the username so the same person always gets the same one. */
const FALLBACK_GRADIENTS = [
  "from-yellow-400 to-orange-500",
  "from-sky-400 to-blue-600",
  "from-pink-400 to-purple-600",
  "from-green-400 to-teal-600",
  "from-cyan-400 to-blue-500",
  "from-orange-400 to-red-500",
];

export function fallbackGradient(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return FALLBACK_GRADIENTS[Math.abs(hash) % FALLBACK_GRADIENTS.length];
}

export default function Avatar(props: AvatarProps) {
  const [error, setError] = createSignal(false);

  createEffect(
    on(
      () => props.user,
      () => {
        setError(false);
      },
    ),
  );

  const fallback = () => props.user?.username?.at(0) || "?";

  const pictureUrl = () => {
    if (props.user?.image?.startsWith("/")) {
      return joinURL(config.API_URL, props.user.image);
    }

    return props.user?.image || undefined;
  };

  return (
    <div
      classList={{
        [avatar({ size: props.size })]: true,
        [props.class || ""]: !!props.class,
      }}
    >
      <div
        class={`col-start-1 row-start-1 flex h-full w-full items-center justify-center rounded-full bg-linear-to-b font-black text-white uppercase ${fallbackGradient(props.user?.username ?? "")}`}
      >
        {fallback()}
      </div>
      <Show when={!error() && props.user?.image}>
        <img
          onError={() => setError(true)}
          src={pictureUrl()}
          alt={props.user?.username ?? ""}
          class="col-start-1 row-start-1 block h-full w-full rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      </Show>
    </div>
  );
}
