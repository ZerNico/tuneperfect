import { createSignal, type JSX, onMount } from "solid-js";
import IconAppleLogo from "~icons/ph/apple-logo-fill";
import IconLinuxLogo from "~icons/ph/linux-logo-fill";
import IconWindowsLogo from "~icons/ph/windows-logo-fill";

export type PlatformId = "macos" | "windows" | "linux";

export interface Platform {
  id: PlatformId;
  name: string;
  detail: string;
  icon: (props: { class?: string }) => JSX.Element;
}

export const PLATFORMS: Platform[] = [
  { id: "macos", name: "macOS", detail: "Apple Silicon & Intel · macOS 12+", icon: IconAppleLogo },
  { id: "windows", name: "Windows", detail: "x64 & ARM64 · Windows 10+", icon: IconWindowsLogo },
  { id: "linux", name: "Linux", detail: "AppImage, .deb & .rpm", icon: IconLinuxLogo },
];

function detect(): PlatformId {
  const agent = navigator.userAgent;
  if (/Mac/.test(agent) && !/iPhone|iPad/.test(agent)) return "macos";
  if (/Linux|X11/.test(agent) && !/Android/.test(agent)) return "linux";
  return "windows";
}

/** The visitor's platform; macOS during SSR, corrected once mounted. */
export function usePlatform() {
  const [id, setId] = createSignal<PlatformId>("macos");
  onMount(() => setId(detect()));
  return () => PLATFORMS.find((platform) => platform.id === id())!;
}
