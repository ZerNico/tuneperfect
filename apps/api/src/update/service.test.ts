import { describe, expect, it, spyOn } from "bun:test";

import { updateService } from "./service";

describe("getReleaseName", () => {
  it("maps darwin aarch64 to the arm app archive", async () => {
    expect(await updateService.getReleaseName("darwin", "aarch64", "1.2.3")).toBe(
      "Tune.Perfect_1.2.3_aarch64.app.tar.gz",
    );
  });

  it("maps darwin x86_64 to the x64 app archive", async () => {
    expect(await updateService.getReleaseName("darwin", "x86_64", "1.2.3")).toBe("Tune.Perfect_1.2.3_x64.app.tar.gz");
  });

  it("maps windows targets to setup executables", async () => {
    expect(await updateService.getReleaseName("windows", "x86_64", "1.2.3")).toBe("Tune.Perfect_1.2.3_x64-setup.exe");
    expect(await updateService.getReleaseName("windows", "aarch64", "1.2.3")).toBe(
      "Tune.Perfect_1.2.3_arm64-setup.exe",
    );
  });

  it("maps linux x86_64 to the AppImage", async () => {
    expect(await updateService.getReleaseName("linux", "x86_64", "1.2.3")).toBe("Tune.Perfect_1.2.3_amd64.AppImage");
  });

  it("returns null for unknown target/arch combinations", async () => {
    expect(await updateService.getReleaseName("freebsd", "x86_64", "1.2.3")).toBeNull();
    expect(await updateService.getReleaseName("linux", "aarch64", "1.2.3")).toBeNull();
    expect(await updateService.getReleaseName("", "", "1.2.3")).toBeNull();
  });

  it("does not allow path traversal through target or arch", async () => {
    expect(await updateService.getReleaseName("../..", "etc", "1.2.3")).toBeNull();
  });
});

describe("resolveUpdate", () => {
  const options = {
    githubRepo: "owner/repo",
    target: "linux",
    arch: "x86_64",
    currentVersion: "0.3.1",
    releaseVersion: "v0.4.0",
  };

  it("points at the release file and its signature when a newer release exists", async () => {
    const download = spyOn(updateService, "downloadSignatureFile").mockResolvedValue("c2lnbmF0dXJl");

    expect(await updateService.resolveUpdate(options)).toEqual({
      version: "0.4.0",
      url: "https://github.com/owner/repo/releases/download/v0.4.0/Tune.Perfect_0.4.0_amd64.AppImage",
      signature: "c2lnbmF0dXJl",
    });
    expect(download).toHaveBeenCalledWith(
      "https://github.com/owner/repo/releases/download/v0.4.0/Tune.Perfect_0.4.0_amd64.AppImage.sig",
    );
    download.mockRestore();
  });

  it("offers nothing to clients already on that release or newer", async () => {
    expect(await updateService.resolveUpdate({ ...options, currentVersion: "0.4.0" })).toBeNull();
    expect(await updateService.resolveUpdate({ ...options, currentVersion: "0.5.0" })).toBeNull();
  });

  it("offers nothing without a repository, a release file or a signature", async () => {
    expect(await updateService.resolveUpdate({ ...options, githubRepo: undefined })).toBeNull();
    expect(await updateService.resolveUpdate({ ...options, target: "freebsd" })).toBeNull();

    const download = spyOn(updateService, "downloadSignatureFile").mockResolvedValue(null);
    expect(await updateService.resolveUpdate(options)).toBeNull();
    download.mockRestore();
  });
});
