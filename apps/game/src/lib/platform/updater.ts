export interface Update {
  version: string;
  downloadAndInstall(): Promise<void>;
}

/** In-app updates aren't wired up for the Electron build yet, so there's never one to offer. */
export async function check(): Promise<Update | null> {
  return null;
}
