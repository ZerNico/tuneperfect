import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import sharp from "sharp";

import { InvalidImageError, userService } from "./service";

afterEach(() => {
  mock.restore();
});

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#808080" } })
    .png()
    .toBuffer();

const file = (bytes: Uint8Array<ArrayBuffer>, type = "image/png") => new File([bytes], "picture", { type });

describe("storeUserImage", () => {
  it("stores a real image as WebP", async () => {
    const write = spyOn(Bun, "write").mockResolvedValue(0);

    await userService.storeUserImage("user-1", file(await png(64, 64)));

    expect(write).toHaveBeenCalledTimes(1);
    const stored = write.mock.calls[0]?.[1] as unknown as Buffer;
    expect((await sharp(stored).metadata()).format).toBe("webp");
  });

  it("refuses bytes that only claim to be an image", async () => {
    const write = spyOn(Bun, "write").mockResolvedValue(0);

    await expect(
      userService.storeUserImage("user-1", file(new TextEncoder().encode("not a picture"))),
    ).rejects.toBeInstanceOf(InvalidImageError);
    expect(write).not.toHaveBeenCalled();
  });

  it("refuses huge dimensions even when the file is small", async () => {
    const write = spyOn(Bun, "write").mockResolvedValue(0);

    await expect(userService.storeUserImage("user-1", file(await png(5000, 5000)))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
    expect(write).not.toHaveBeenCalled();
  });
});
