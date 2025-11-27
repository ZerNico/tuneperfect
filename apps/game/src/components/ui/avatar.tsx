import { createEffect, createSignal, on, Show } from "solid-js";
import { twMerge } from "tailwind-merge";
import { joinURL } from "ufo";

interface AvatarProps {
  user: {
    image?: string | null;
    username?: string | null;
  };
  class?: string;
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
      return joinURL(import.meta.env.VITE_API_URL ?? "", props.user.image);
    }

    return props.user?.image || undefined;
  };

  return (
    <div class={twMerge("grid h-10 w-10", props.class)}>
      <div class="gradient-settings col-start-1 row-start-1 flex h-full w-full items-center justify-center rounded-full bg-linear-to-tr text-white leading-none">
        {fallback()}
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
