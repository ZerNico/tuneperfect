import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { call } from "@orpc/server";

import { expectORPCError, lobbyContext, makeUser } from "../../test/helpers";
import { lobbyService } from "../lobby/service";
import { highscoreRouter } from "./router";
import { highscoreService } from "./service";

const LOBBY_ID = "ABCD2345";

afterEach(() => {
  mock.restore();
});

function stubLobbyWith(user: ReturnType<typeof makeUser>) {
  spyOn(lobbyService, "getLobbyById").mockResolvedValue({
    id: LOBBY_ID,
    users: [user],
  } as unknown as Awaited<ReturnType<typeof lobbyService.getLobbyById>>);
}

describe("setHighscore", () => {
  it("stores a valid score for a user in the lobby", async () => {
    const user = makeUser();
    stubLobbyWith(user);
    const setSpy = spyOn(highscoreService, "setHighscore").mockResolvedValue(
      undefined as Awaited<ReturnType<typeof highscoreService.setHighscore>>,
    );

    await call(
      highscoreRouter.setHighscore,
      { hash: "song-hash-1", userId: user.id, score: 4200, difficulty: "easy" },
      { context: await lobbyContext(LOBBY_ID) },
    );

    expect(setSpy).toHaveBeenCalledWith("song-hash-1", user.id, 4200, "easy");
  });

  it("accepts the maximum possible score (100000)", async () => {
    const user = makeUser();
    stubLobbyWith(user);
    const setSpy = spyOn(highscoreService, "setHighscore").mockResolvedValue(
      undefined as Awaited<ReturnType<typeof highscoreService.setHighscore>>,
    );

    await call(
      highscoreRouter.setHighscore,
      { hash: "song-hash-1", userId: user.id, score: 100_000, difficulty: "easy" },
      { context: await lobbyContext(LOBBY_ID) },
    );

    expect(setSpy).toHaveBeenCalledWith("song-hash-1", user.id, 100_000, "easy");
  });

  it("rejects a float score", async () => {
    const user = makeUser();
    stubLobbyWith(user);

    await expectORPCError(
      call(
        highscoreRouter.setHighscore,
        { hash: "song-hash-1", userId: user.id, score: 3.5, difficulty: "easy" },
        { context: await lobbyContext(LOBBY_ID) },
      ),
      "BAD_REQUEST",
    );
  });

  it("rejects an infinite score", async () => {
    const user = makeUser();
    stubLobbyWith(user);

    await expectORPCError(
      call(
        highscoreRouter.setHighscore,
        { hash: "song-hash-1", userId: user.id, score: Number.POSITIVE_INFINITY, difficulty: "easy" },
        { context: await lobbyContext(LOBBY_ID) },
      ),
      "BAD_REQUEST",
    );
  });

  it("rejects a NaN score", async () => {
    const user = makeUser();
    stubLobbyWith(user);

    await expectORPCError(
      call(
        highscoreRouter.setHighscore,
        { hash: "song-hash-1", userId: user.id, score: Number.NaN, difficulty: "easy" },
        { context: await lobbyContext(LOBBY_ID) },
      ),
      "BAD_REQUEST",
    );
  });

  it("rejects a negative score", async () => {
    const user = makeUser();
    stubLobbyWith(user);

    await expectORPCError(
      call(
        highscoreRouter.setHighscore,
        { hash: "song-hash-1", userId: user.id, score: -1, difficulty: "easy" },
        { context: await lobbyContext(LOBBY_ID) },
      ),
      "BAD_REQUEST",
    );
  });

  it("rejects a score above the maximum possible score (100001)", async () => {
    const user = makeUser();
    stubLobbyWith(user);

    await expectORPCError(
      call(
        highscoreRouter.setHighscore,
        { hash: "song-hash-1", userId: user.id, score: 100_001, difficulty: "easy" },
        { context: await lobbyContext(LOBBY_ID) },
      ),
      "BAD_REQUEST",
    );
  });

  it("rejects an empty hash", async () => {
    const user = makeUser();
    stubLobbyWith(user);

    await expectORPCError(
      call(
        highscoreRouter.setHighscore,
        { hash: "", userId: user.id, score: 4200, difficulty: "easy" },
        { context: await lobbyContext(LOBBY_ID) },
      ),
      "BAD_REQUEST",
    );
  });

  it("rejects an over-long hash", async () => {
    const user = makeUser();
    stubLobbyWith(user);

    await expectORPCError(
      call(
        highscoreRouter.setHighscore,
        { hash: "a".repeat(257), userId: user.id, score: 4200, difficulty: "easy" },
        { context: await lobbyContext(LOBBY_ID) },
      ),
      "BAD_REQUEST",
    );
  });

  it("rejects a user that is not in the lobby", async () => {
    const user = makeUser();
    const outsider = makeUser();
    stubLobbyWith(user);

    await expectORPCError(
      call(
        highscoreRouter.setHighscore,
        { hash: "song-hash-1", userId: outsider.id, score: 4200, difficulty: "easy" },
        { context: await lobbyContext(LOBBY_ID) },
      ),
      "UNAUTHORIZED",
    );
  });
});
