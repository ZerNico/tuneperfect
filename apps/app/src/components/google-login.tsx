import { createSignal } from "solid-js";
import { joinURL, withQuery } from "ufo";
import GoogleIcon from "~icons/logos/google-icon";
import Button from "./ui/button";

interface GoogleLoginProps {
  redirect?: string;
}

export default function GoogleLogin(props: GoogleLoginProps) {
  const [loading, setLoading] = createSignal(false);

  const login = async () => {
    setLoading(true);
    window.location.href = withQuery(joinURL(import.meta.env.VITE_API_URL ?? "", "/v1.0/auth/providers/google/authorize"), {
      redirect: props.redirect,
    });
  };

  return (
    <Button class="flex-1" onClick={login} loading={loading()}>
      <GoogleIcon class="text-sm" /> Google
    </Button>
  );
}
