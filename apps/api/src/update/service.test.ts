import { describe, expect, it } from "bun:test";

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
