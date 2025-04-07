import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/_auth/_lobby/")({
  component: App,
  beforeLoad: async () => {
   
  },
});

function App() {
  return <main>123</main>;
}
