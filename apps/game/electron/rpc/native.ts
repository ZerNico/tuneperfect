import { systemPreferences } from "electron";

import type { ParsedSongs, RescannedSongs as NativeRescannedSongs } from "../../native/index";
import type { ParseSongsEvent, RescannedSongs, UsdbCatalogEvent } from "../../src/lib/native/contract";
import { SONG_FILES_BASE_URL } from "../../src/lib/native/media";
import type { SongDirGroup, SongGroup, UsdbSearchEntry } from "../../src/lib/native/types.gen";
import { native } from "../native";
import type { SongFolders } from "../song-folders";
import { os, stream, subscription } from "./base";

/**
 * macOS attributes microphone access to the app bundle. Asking explicitly shows the
 * prompt; without it CoreAudio can silently deliver zeros.
 */
async function ensureMicrophoneAccess(): Promise<void> {
  if (process.platform !== "darwin") return;
  if (systemPreferences.getMediaAccessStatus("microphone") === "granted") return;
  await systemPreferences.askForMediaAccess("microphone");
}

export interface NativeDependencies {
  songFolders: SongFolders;
}

/** Procedures backed by the Rust addon. */
export function nativeProcedures({ songFolders }: NativeDependencies) {
  return {
    microphones: {
      list: os.microphones.list.handler(async () => {
        await ensureMicrophoneAccess();
        return native.getMicrophones();
      }),
    },
    recording: {
      start: os.recording.start.handler(async ({ input }) => {
        await ensureMicrophoneAccess();
        await native.startRecording(input.microphones, input.playbackEnabled, input.playbackVolume);
      }),
      stop: os.recording.stop.handler(() => native.stopRecording()),
    },
    pitch: {
      get: os.pitch.get.handler(({ input }) => native.getPitches(input.windowMs)),
      stream: os.pitch.stream.handler(({ signal }) =>
        subscription<Float64Array>(signal, (emit) => {
          const id = native.subscribePitchFrames(emit);
          return () => native.unsubscribePitchFrames(id);
        }),
      ),
    },
    songs: {
      parse: os.songs.parse.handler(({ input }) => {
        // A known folder that was missing (an unplugged drive) is granted again once it's back.
        songFolders.grantKnown();
        return stream<ParseSongsEvent, ParsedSongs>(
          (emit) => native.parseSongsFromPaths(input.paths, SONG_FILES_BASE_URL, emit),
          ({ groups, notes, noteRanges }) => ({ type: "done", groups: groups as SongGroup[], notes, noteRanges }),
        );
      }),
      // One event rather than a plain result: only stream events keep the notes binary.
      rescan: os.songs.rescan.handler(({ input }) =>
        stream<RescannedSongs, NativeRescannedSongs>(
          () => native.rescanSongs(input.paths, SONG_FILES_BASE_URL),
          (rescan) => ({ ...rescan, groups: rescan.groups as SongDirGroup[] }),
        ),
      ),
    },
    usdb: {
      login: os.usdb.login.handler(({ input }) => native.usdbLogin(input.username, input.password)),
      logout: os.usdb.logout.handler(() => native.usdbLogout()),
      isLoggedIn: os.usdb.isLoggedIn.handler(() => native.usdbIsLoggedIn()),
      fetchCatalog: os.usdb.fetchCatalog.handler(({ input }) =>
        stream<UsdbCatalogEvent, UsdbSearchEntry[]>(
          (emit) =>
            native.usdbFetchCatalog(input.lastMtime, input.lastSongIds, (progress) =>
              emit({ type: "progress", ...progress }),
            ),
          (catalog) => ({ type: "done", catalog }),
        ),
      ),
      getSong: os.usdb.getSong.handler(({ input }) => native.usdbGetSong(input.songId)),
      getSongPreview: os.usdb.getSongPreview.handler(({ input }) => native.usdbGetSongPreview(input.songId)),
    },
  };
}
