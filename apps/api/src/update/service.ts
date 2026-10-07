import semver from "semver";

export interface UpdateManifest {
  version: string;
  url: string;
  signature: string;
}

const SIGNATURE_TIMEOUT_MS = 5000;

export class UpdateService {
  /**
   * The update a client on `currentVersion` should install to reach `releaseVersion`, in the
   * format both the Tauri and the Electron updater read, or `null` if there is none.
   */
  async resolveUpdate(options: {
    githubRepo: string | undefined;
    target: string;
    arch: string;
    currentVersion: string;
    releaseVersion: string;
  }): Promise<UpdateManifest | null> {
    if (!options.githubRepo) return null;

    const currentVersion = semver.coerce(options.currentVersion);
    const releaseVersion = semver.coerce(options.releaseVersion);
    if (!currentVersion || !releaseVersion || semver.gte(currentVersion, releaseVersion)) return null;

    const releaseName = await this.getReleaseName(options.target, options.arch, releaseVersion.version);
    if (!releaseName) return null;

    const url = `https://github.com/${options.githubRepo}/releases/download/v${releaseVersion.version}/${releaseName}`;
    const signature = await this.downloadSignatureFile(`${url}.sig`);
    if (!signature) return null;

    return { version: releaseVersion.version, url, signature };
  }

  async getReleaseName(target: string, arch: string, version: string) {
    const fileMap = new Map<string, string>([
      ["darwin-aarch64", `Tune.Perfect_${version}_aarch64.app.tar.gz`],
      ["darwin-arm", `Tune.Perfect_${version}_aarch64.app.tar.gz`],
      ["darwin-x86_64", `Tune.Perfect_${version}_x64.app.tar.gz`],
      ["windows-x86_64", `Tune.Perfect_${version}_x64-setup.exe`],
      ["windows-aarch64", `Tune.Perfect_${version}_arm64-setup.exe`],
      ["windows-arm", `Tune.Perfect_${version}_arm64-setup.exe`],
      ["linux-x86_64", `Tune.Perfect_${version}_amd64.AppImage`],
    ]);

    const file = fileMap.get(`${target}-${arch}`);

    return file || null;
  }

  /** A release's signature never changes, so each is fetched from GitHub once, not on every update check. */
  private readonly signatures = new Map<string, string>();

  /** The signature file's text, or null when GitHub doesn't answer in time or has none (no update then). */
  async downloadSignatureFile(signatureFileUrl: string) {
    const cached = this.signatures.get(signatureFileUrl);
    if (cached !== undefined) return cached;

    try {
      const response = await fetch(signatureFileUrl, { signal: AbortSignal.timeout(SIGNATURE_TIMEOUT_MS) });
      if (!response.ok) return null;

      const signature = await response.text();
      this.signatures.set(signatureFileUrl, signature);
      return signature;
    } catch {
      return null;
    }
  }
}

export const updateService = new UpdateService();
