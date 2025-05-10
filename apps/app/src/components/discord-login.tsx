import { createSignal } from "solid-js";
import { joinURL, withQuery } from "ufo";
import DiscordIcon from "~icons/logos/discord-icon";
import Button from "./ui/button";

interface DiscordLoginProps {
  redirect?: string;
}

export default function DiscordLogin(props: DiscordLoginProps) {
  const [loading, setLoading] = createSignal(false);

  const login = async () => {
    setLoading(true);
    window.location.href = withQuery(joinURL(import.meta.env.VITE_API_URL ?? "", "/v1.0/auth/providers/discord/authorize"), {
      redirect: props.redirect,
    });
  };

  return (
    <Button class="flex-1" onClick={login} loading={loading()}>
      <DiscordIcon class="text-sm" /> Discord
    </Button>
  );
}
