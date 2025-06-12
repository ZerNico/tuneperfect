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

async function getMediaUrl(filePath: string): Promise<string> {
  try {
    const result = await commands.getMediaServerBaseUrl();
    if (result.status === "ok" && result.data) {
      // Use media server URL
      const encodedPath = encodeURIComponent(filePath);
      return `${result.data}/${encodedPath}`;
    }
  } catch (error) {
    console.warn("Failed to get media server base URL:", error);
  }

  // Fallback to asset protocol
  return convertFileSrc(filePath);
}

export interface SongParsingProgress {
  currentSong: string;
  current: number;
  total: number;
}

export interface SongFile {
  txt: DirEntryWithChildren;
  files: DirEntryWithChildren[];
  sourcePath: string;
}

export function collectSongFiles(root: DirEntryWithChildren, sourcePath: string): SongFile[] {
  const songFiles: SongFile[] = [];

  const findTxtFiles = (node: DirEntryWithChildren) => {
    for (const child of node.children) {
      if (child.isDirectory) {
        findTxtFiles(child);
      } else if (child.name.endsWith(".txt")) {
        songFiles.push({ 
          txt: child, 
          files: node.children, 
          sourcePath 
        });
      }
    }
  };
  
  findTxtFiles(root);
  return songFiles;
}

export async function parseAllSongFiles(
  songFiles: SongFile[],
  onProgress?: (progress: SongParsingProgress) => void
): Promise<{ songs: LocalSong[]; songsByPath: Map<string, LocalSong[]> }> {
  const limit = pLimit(5);
  const totalSongs = songFiles.length;
  const songsByPath = new Map<string, LocalSong[]>();
  
  const results = await Promise.allSettled(
    songFiles.map((songFile, index) => 
      limit(async () => {
        const result = await parseLocalTxtFile(songFile.txt, songFile.files);
        
        if (onProgress) {
          onProgress({
            currentSong: songFile.txt.name,
            current: index + 1,
            total: totalSongs,
          });
        }
        
        return { song: result, sourcePath: songFile.sourcePath };
      })
    )
  );

  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  for (const result of rejected) {
    console.error("Failed to parse song:", result.reason);
  }

  const songs: LocalSong[] = [];
  
  for (const result of fulfilled) {
    const { song, sourcePath } = result.value;
    songs.push(song);
    
    if (!songsByPath.has(sourcePath)) {
      songsByPath.set(sourcePath, []);
    }
    songsByPath.get(sourcePath)?.push(song);
  }

  return { songs, songsByPath };
}

// Keep the old function for backward compatibility but simplify it
export async function parseLocalFileTree(
  root: DirEntryWithChildren, 
  onProgress?: (progress: SongParsingProgress) => void
) {
  const songFiles = collectSongFiles(root, root.path);
  const { songs } = await parseAllSongFiles(songFiles, onProgress);
  return songs;
}

async function parseLocalTxtFile(txt: DirEntryWithChildren, files: DirEntryWithChildren[]) {
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
      localSong[keyUrl] = await getMediaUrl(file.path);
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
