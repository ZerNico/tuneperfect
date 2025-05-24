import { convertFileSrc } from "@tauri-apps/api/core";
import { readTextFile } from "@tauri-apps/plugin-fs";
import pLimit from "p-limit";
import { commands } from "~/bindings";
import type { DirEntryWithChildren } from "~/lib/utils/fs";
import type { Song } from "../song";
import { ParseError } from "./error";
import { parseUltrastarTxt } from "./txt";


function normalizeFilename(filename: string): string {
  return filename.normalize("NFC").toLowerCase();
}


function findFileByName(files: DirEntryWithChildren[], targetFilename: string): DirEntryWithChildren | undefined {
  const normalizedTarget = normalizeFilename(targetFilename);
  return files.find((f) => normalizeFilename(f.name) === normalizedTarget);
}

export async function parseLocalFileTree(root: DirEntryWithChildren) {
  const songFiles: { txt: DirEntryWithChildren; files: DirEntryWithChildren[] }[] = [];

  const findTxtFiles = (node: DirEntryWithChildren) => {
    for (const child of node.children) {
      if (child.isDirectory) {
        findTxtFiles(child);
      } else if (child.name.endsWith(".txt")) {
        songFiles.push({ txt: child, files: node.children });
      }
    }
  };
  findTxtFiles(root);

  const limit = pLimit(5);
  const results = await Promise.allSettled(
    songFiles.map((song) => limit(() => parseLocalTxtFile(song.txt, song.files))),
  );
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  // TODO: Display errors
  for (const result of rejected) {
    console.error(result.reason);
  }

  const songs = fulfilled.map((result) => result.value);
  return songs;
}

export async function parseLocalTxtFile(txt: DirEntryWithChildren, files: DirEntryWithChildren[]) {
  try {
    const content = await readTextFile(txt.path);
    const song = parseUltrastarTxt(content);

    const localSong: LocalSong = song;
    const hasAudio = !!song.audio && !!findFileByName(files, song.audio);

    for (const type of ["audio", "video", "cover", "background"] as const) {
      if (!song[type]) {
        continue;
      }

      const file = findFileByName(files, song[type]);

      if (!file) {
        // Handle missing files according to requirements
        if (type === "audio") {
          throw new ParseError(`Audio file ${song[type]} not found`);
        }

        if (type === "video" && !hasAudio) {
          throw new ParseError(`Video file ${song[type]} not found and no audio file available`);
        }

        console.warn(`Warning: ${type} file ${song[type]} not found for ${txt.name}`);
        continue;
      }

      const keyUrl: `${typeof type}Url` = `${type}Url`;
      localSong[keyUrl] = convertFileSrc(file.path);
    }

    if (song.audio) {
      const file = findFileByName(files, song.audio);

      if (file) {
        const result = await commands.getReplayGain(file.path);
        if (result.status === "ok") {
          localSong.replayGainTrackGain = result.data.track_gain || undefined;
          localSong.replayGainTrackPeak = result.data.track_peak || undefined;
        }
      }
    }

    return localSong;
  } catch (error) {
    const message = error instanceof Error ? `: ${error.message}` : "";
    throw new ParseError(`Failed to parse ${txt.name}${message}`);
  }
}

export interface LocalSong extends Song {
  audioUrl?: string;
  videoUrl?: string;
  coverUrl?: string;
  backgroundUrl?: string;
  replayGainTrackGain?: number;
  replayGainTrackPeak?: number;
}
