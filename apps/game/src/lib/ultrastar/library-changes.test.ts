import { describe, expect, it } from "vitest";

import { applyFolderChanges, uniqueSongs } from "./library-changes";
import type { LocalSong } from "./song";

const song = (txtPath: string, hash = txtPath) =>
  ({ txtPath, songDir: txtPath.slice(0, txtPath.lastIndexOf("/")), hash }) as LocalSong;
const paths = (songs: LocalSong[] | undefined) => songs?.map((s) => s.txtPath);

describe("applyFolderChanges", () => {
  const library = new Map([
    ["/root", [song("/root/a/a.txt"), song("/root/a/a2.txt"), song("/root/b/b.txt")]],
    ["/other", [song("/other/c/c.txt")]],
  ]);

  it("replaces a changed folder's songs and keeps the rest", () => {
    const edited = song("/root/a/a.txt", "new-hash");
    const changes = applyFolderChanges(library, [
      { root: "/root", dir: "/root/a", songs: [edited] },
      { root: "/root", dir: "/root/new", songs: [song("/root/new/n.txt")] },
    ]);
    expect(paths(changes.roots.get("/root"))).toEqual(["/root/b/b.txt", "/root/a/a.txt", "/root/new/n.txt"]);
    expect(changes.roots.has("/other")).toBe(false);
    expect(changes.replaced.get("/root/a/a.txt")).toBe(edited);
    expect(changes.replaced.get("/root/a/a2.txt")).toBeNull();
    expect(changes.replaced.has("/root/b/b.txt")).toBe(false);
  });

  it("removes a folder that is gone and ignores roots not in the library", () => {
    const changes = applyFolderChanges(library, [
      { root: "/root", dir: "/root/b", songs: [] },
      { root: "/removed", dir: "/removed/x", songs: [song("/removed/x/x.txt")] },
    ]);
    expect(paths(changes.roots.get("/root"))).toEqual(["/root/a/a.txt", "/root/a/a2.txt"]);
    expect(changes.roots.has("/removed")).toBe(false);
    expect(changes.replaced.get("/root/b/b.txt")).toBeNull();
  });

  it("doesn't touch a parent folder's own songs", () => {
    const nested = new Map([["/root", [song("/root/a/a.txt"), song("/root/a/sub/s.txt")]]]);
    const changes = applyFolderChanges(nested, [{ root: "/root", dir: "/root/a/sub", songs: [] }]);
    expect(paths(changes.roots.get("/root"))).toEqual(["/root/a/a.txt"]);
  });
});

describe("uniqueSongs", () => {
  it("keeps the copy with the first song file, whatever the order", () => {
    const first = song("/a/x.txt", "same");
    const second = song("/b/x.txt", "same");
    expect(uniqueSongs([[second], [first]])).toEqual([first]);
    expect(uniqueSongs([[first], [second]])).toEqual([first]);
  });
});
