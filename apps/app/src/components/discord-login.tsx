import { createSignal } from "solid-js";
import { joinURL } from "ufo";
import DiscordIcon from "~icons/logos/discord-icon";
import Button from "./ui/button";

interface DiscordLoginProps {
  redirect?: string;
}

export default function DiscordLogin(props: DiscordLoginProps) {
  const [loading, setLoading] = createSignal(false);

  const login = async () => {
    setLoading(true);

    /*await authClient.signIn.social({
      provider: "discord",
      callbackURL: joinURL(`${window.location.origin}`, props.redirect ?? ""),
    });*/

    setLoading(false);
  };

  return (
    <Button class="flex-1" onClick={login} loading={loading()}>
      <DiscordIcon class="text-sm" /> Discord
    </Button>
  );
}
