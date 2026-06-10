import { describe, expect, it } from "bun:test";

import { filterNullish } from "./array";

describe("filterNullish", () => {
  it("removes null and undefined entries", () => {
    expect(filterNullish([1, null, 2, undefined, 3])).toEqual([1, 2, 3]);
  });

  it("keeps falsy but non-nullish values", () => {
    expect(filterNullish([0, "", false, null, undefined])).toEqual([0, "", false]);
  });

  it("returns an empty array unchanged", () => {
    expect(filterNullish([])).toEqual([]);
  });
});
