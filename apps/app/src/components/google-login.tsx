import { createSignal } from "solid-js";
import { joinURL } from "ufo";
import { authClient } from "~/lib/auth";
import GoogleIcon from "~icons/logos/google-icon";
import Button from "./ui/button";

interface GoogleLoginProps {
  redirect?: string;
}

export default function GoogleLogin(props: GoogleLoginProps) {
  const [loading, setLoading] = createSignal(false);

  const login = async () => {
    setLoading(true);

    await authClient.signIn.social({
      provider: "google",
      callbackURL: joinURL(`${window.location.origin}`, props.redirect ?? ""),
    });

    setLoading(false);
  };

  return (
    <Button class="flex-1" onClick={login} loading={loading()}>
      <GoogleIcon class="text-sm" /> Google
    </Button>
  );
}
