export class UpdateService {
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

  async downloadSignatureFile(signatureFileUrl: string) {
    const response = await fetch(signatureFileUrl);

    if (!response.ok) {
      return null;
    }

    return response.text();
  }
}

export const updateService = new UpdateService();
