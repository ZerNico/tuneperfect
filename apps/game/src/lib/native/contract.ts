import { eventIterator, oc, type } from "@orpc/contract";
import * as v from "valibot";

import type {
  LocalSong,
  Microphone,
  ParseEvent,
  SongGroup,
  UsdbSearchEntry,
  UsdbSong,
  UsdbSongPreview,
  UsdbSyncProgressEvent,
} from "./types.gen";

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

export type ParseSongsEvent = ParseEvent | { type: "done"; groups: SongGroup[] };

export type UsdbCatalogEvent =
  | ({ type: "progress" } & UsdbSyncProgressEvent)
  | { type: "done"; catalog: UsdbSearchEntry[] };

export type UpdateInstallEvent = { type: "progress"; downloaded: number; total: number | null };

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
    /** The voices (notes) of one parsed song: the library itself only carries metadata. */
    voices: base.input(v.object({ txtPath: v.string() })).output(type<LocalSong["voices"]>()),
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
  /** JSON files in the app's data directory, one object each (settings.json, local.json, …). */
  store: {
    /** The file's contents, or `null` if it doesn't exist or isn't a JSON object. */
    read: base.input(v.object({ file: v.string() })).output(type<Record<string, unknown> | null>()),
    write: base.input(v.object({ file: v.string(), data: v.record(v.string(), v.unknown()) })),
  },
  dialog: {
    /** Lets the user pick a song folder and grants the app access to it. */
    pickFolder: base.output(type<string | null>()),
    /** Lets the user pick an image (PNG, JPEG or WebP) and returns it as a data URL. */
    pickImage: base.output(type<string | null>()),
  },
  window: {
    toggleFullscreen: base,
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
    /** Quits the app (pending settings are saved first). */
    exit: base,
    log: base.input(v.object({ level: v.picklist(["warn", "error"]), message: v.string() })),
  },
};

export type NativeContract = typeof contract;
