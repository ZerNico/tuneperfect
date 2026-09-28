import { eventIterator, oc, type } from "@orpc/contract";
import * as v from "valibot";

import type { Microphone, SongGroup, UsdbSearchEntry, UsdbSong, UsdbSongPreview } from "./types";

/**
 * The contract between the renderer and Electron's main process, served over a
 * MessagePort (see `electron/rpc`). Inputs are validated with Valibot on the main side;
 * outputs come from trusted native code and are typed without runtime validation, which
 * keeps large payloads like a parsed song library cheap.
 */

const appErrorSchema = v.object({ type: v.string(), data: v.string() });

/** Every procedure can fail with the native layer's `AppError`, carried as `data`. */
const base = oc.errors({ NATIVE_ERROR: { data: appErrorSchema } });

const microphoneOptionsSchema = v.object({
  deviceId: v.nullish(v.string()),
  name: v.string(),
  channel: v.number(),
  gain: v.number(),
  threshold: v.number(),
  delay: v.number(),
});

export type ParseSongsEvent =
  | { type: "start"; total: number }
  | { type: "progress"; song: string }
  | { type: "done"; groups: SongGroup[] };

export type UsdbCatalogEvent =
  | { type: "progress"; fetched: number; total: number }
  | { type: "done"; catalog: UsdbSearchEntry[] };

export type UpdateInstallEvent = { type: "progress"; downloaded: number; total: number | null };

export type DialogFilter = v.InferOutput<typeof dialogFilterSchema>;
const dialogFilterSchema = v.object({ name: v.string(), extensions: v.array(v.string()) });

export const contract = {
  microphones: {
    list: base.output(type<Microphone[]>()),
  },
  recording: {
    start: base.input(
      v.object({
        microphones: v.array(microphoneOptionsSchema),
        playbackEnabled: v.boolean(),
        playbackVolume: v.number(),
      }),
    ),
    stop: base,
  },
  pitch: {
    /** Pitch in Hz per microphone over the last `windowMs`; `-1` where there is none. */
    get: base.input(v.object({ windowMs: v.number() })).output(type<number[]>()),
    levels: base.output(type<number[]>()),
  },
  songs: {
    /** Parses the given (granted) folders, streaming progress before the result. */
    parse: base.input(v.object({ paths: v.array(v.string()) })).output(eventIterator(type<ParseSongsEvent>())),
  },
  localServer: {
    baseUrl: base.output(type<string | null>()),
  },
  usdb: {
    login: base.input(v.object({ username: v.string(), password: v.string() })).output(type<boolean>()),
    logout: base,
    isLoggedIn: base.output(type<boolean>()),
    fetchCatalog: base
      .input(v.object({ lastMtime: v.number(), lastSongIds: v.array(v.number()) }))
      .output(eventIterator(type<UsdbCatalogEvent>())),
    getSong: base.input(v.object({ songId: v.number() })).output(type<UsdbSong>()),
    getSongPreview: base.input(v.object({ songId: v.number() })).output(type<UsdbSongPreview>()),
  },
  store: {
    entries: base.input(v.object({ file: v.string() })).output(type<[string, unknown][]>()),
    get: base.input(v.object({ file: v.string(), key: v.string() })).output(type<unknown>()),
    set: base.input(v.object({ file: v.string(), key: v.string(), value: v.unknown() })),
    delete: base.input(v.object({ file: v.string(), key: v.string() })).output(type<boolean>()),
    save: base.input(v.object({ file: v.string() })),
  },
  dialog: {
    open: base
      .input(
        v.object({
          directory: v.optional(v.boolean()),
          multiple: v.optional(v.boolean()),
          filters: v.optional(v.array(dialogFilterSchema)),
        }),
      )
      .output(type<string[] | null>()),
  },
  fs: {
    /** Reads a file picked through `dialog.open` in this session, as base64. */
    readFile: base.input(v.object({ path: v.string() })).output(type<string>()),
  },
  window: {
    isFullscreen: base.output(type<boolean>()),
    setFullscreen: base.input(v.object({ fullscreen: v.boolean() })),
  },
  updates: {
    /** The newer version this installation can update itself to, if there is one. */
    check: base.output(type<{ version: string } | null>()),
    /** Downloads, verifies and installs the update from the last check, then restarts. */
    install: base.output(eventIterator(type<UpdateInstallEvent>())),
  },
  app: {
    /** Song folders passed with `--songpath`/`-s`, or `null` when none were given. */
    songPaths: base.output(type<string[] | null>()),
    exit: base.input(v.object({ code: v.optional(v.number()) })),
    openUrl: base.input(v.object({ url: v.pipe(v.string(), v.url()) })),
    log: base.input(v.object({ level: v.picklist(["warn", "error"]), message: v.string() })),
  },
};

export type NativeContract = typeof contract;
