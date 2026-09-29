import { createEffect, createSignal, on, Show } from "solid-js";
import { twMerge } from "tailwind-merge";
import { joinURL } from "ufo";

interface AvatarProps {
  user: {
    image?: string | null;
    username?: string | null;
  };
  class?: string;
  classList?: Record<string, boolean | undefined>;
  /** CSS classes for the fallback circle (when no image). Defaults to a per-player colour. */
  fallbackClass?: string;
}

const AVATAR_COLORS = ["sky", "red", "blue", "green", "pink", "purple", "yellow", "orange"];

export default function Avatar(props: AvatarProps) {
  const [error, setError] = createSignal(false);

  // A new picture gets a new chance to load.
  createEffect(
    on(
      () => props.user?.image,
      () => setError(false),
    ),
  );

  const fallback = () => props.user?.username?.at(0) || "?";

  // A stable colour per player, from the same palette as the microphones.
  const fallbackColor = () => {
    const name = props.user?.username ?? "";
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
  };

  const pictureUrl = () => {
    if (props.user?.image?.startsWith("/")) {
      return joinURL(import.meta.env.VITE_API_URL ?? "", props.user.image);
    }

    return props.user?.image || undefined;
  };

  return (
    <div class={twMerge("grid h-10 w-10 rounded-full", props.class)} classList={props.classList}>
      <div
        class={twMerge(
          "col-start-1 row-start-1 flex h-full w-full items-center justify-center rounded-full leading-none text-white [container-type:size]",
          props.fallbackClass,
        )}
        style={
          props.fallbackClass
            ? undefined
            : {
                background: `linear-gradient(135deg, var(--color-${fallbackColor()}-400), var(--color-${fallbackColor()}-600))`,
              }
        }
      >
        <span class="text-[50cqh] font-black uppercase">{fallback()}</span>
      </div>
      <Show when={!error() && props.user?.image}>
        <img
          onError={() => setError(true)}
          src={pictureUrl()}
          alt={props.user?.username || "Avatar"}
          class="col-start-1 row-start-1 block h-full w-full rounded-full"
          referrerPolicy="no-referrer"
        />
      </Show>
    </div>
  );
}
