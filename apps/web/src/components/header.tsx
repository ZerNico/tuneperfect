import Button from "./ui/button";

export default function Header() {
  return (
    <>
      <div class="h-16" />
      <header class="fixed top-0 right-0 left-0 z-10 border-white/10 border-b backdrop-blur-lg">
        <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
          <div>
            <span class="font-bold text-lg">Tune Perfect</span>
          </div>
          <div class="flex justify-end gap-2">
            <Button href={import.meta.env.VITE_APP_URL} intent="gradient-sing">
              Join Lobby
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}
