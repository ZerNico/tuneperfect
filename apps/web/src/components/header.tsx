import Button from "./ui/button";

interface HeaderProps {
  appUrl: string;
}

export default function Header(props: HeaderProps) {
  return (
    <>
      <div class="h-16" />
      <header class="fixed top-0 right-0 left-0 z-10 border-white/10 border-b backdrop-blur-lg">
        <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
          <a href="/" class="font-bold text-lg">
            Tune Perfect
          </a>
          <div class="flex justify-end gap-2">
            <Button href={props.appUrl} intent="gradient-sing">
              Join Lobby
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}
