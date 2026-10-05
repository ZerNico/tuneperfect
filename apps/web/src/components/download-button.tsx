import { Dynamic } from "solid-js/web";

import Button from "~/components/ui/button";
import { usePlatform } from "~/lib/platform";

/** "Download for <your OS>", leading to that platform's download page. */
export default function DownloadButton(props: { class?: string }) {
  const platform = usePlatform();
  return (
    <Button to={`/download/${platform().id}`} intent="gradient-sing" size="lg" class={props.class}>
      <Dynamic component={platform().icon} class="text-xl" />
      Download for {platform().name}
    </Button>
  );
}
