import { describe, expect, it, vi } from "vitest";

import { createSongSearchIndex, searchSongIds } from "./use-song-filter";

// The search pulls in i18n, whose settings store talks to the main process on import.
vi.mock("~/lib/native/client", () => ({
  native: new Proxy({}, { get: () => new Proxy(() => Promise.resolve(), { get: () => () => Promise.resolve() }) }),
}));

const songs = [
  { id: "1", artist: "Queen", title: "Bohemian Rhapsody", genre: "Rock" },
  { id: "2", artist: "Queen", title: "Don't Stop Me Now", genre: "Rock" },
  { id: "3", artist: "Bohemian Betyars", title: "Something", genre: "Folk" },
  { id: "4", artist: "Joost", title: "Europapa", genre: "Pop" },
  { id: "5", artist: "Beyoncé", title: "Halo", genre: "Pop" },
];
const index = createSongSearchIndex(songs, "id");
const search = (query: string, scope: Parameters<typeof searchSongIds>[2] = "all") =>
  [...searchSongIds(index, query, scope)].toSorted();

describe("searchSongIds", () => {
  it("needs every word to match, in any field", () => {
    expect(search("queen bohemian")).toEqual(["1"]);
    expect(search("bohemian")).toEqual(["1", "3"]);
    expect(search("queen rock")).toEqual(["1", "2"]);
  });

  it("matches the word being typed as a prefix", () => {
    expect(search("queen boh")).toEqual(["1"]);
  });

  it("tolerates small typos and ignores accents", () => {
    expect(search("europpa")).toEqual(["4"]);
    expect(search("beyonce")).toEqual(["5"]);
  });

  it("treats words with apostrophes as one word", () => {
    expect(search("dont stop")).toEqual(["2"]);
    expect(search("don't stop")).toEqual(["2"]);
    expect(search("don’t")).toEqual(["2"]);
  });

  it("only searches the chosen field", () => {
    expect(search("bohemian", "title")).toEqual(["1"]);
    expect(search("bohemian", "artist")).toEqual(["3"]);
  });
});
