import { join } from "@tauri-apps/api/path";
import { type DirEntry, readDir, stat } from "@tauri-apps/plugin-fs";
import { folderName } from "./path";

export interface DirEntryWithChildren extends DirEntry {
  children: DirEntryWithChildren[];
  path: string;
}

export async function readFileTree(path: string) {
  const rootStat = await stat(path);
  const entries = await readDir(path);

  const root: DirEntryWithChildren = {
    name: folderName(path),
    path,
    isDirectory: rootStat.isDirectory,
    isFile: rootStat.isFile,
    isSymlink: rootStat.isSymlink,
    children: await processEntriesRecursively(path, entries),
  };

  return root;
}

async function processEntriesRecursively(parentPath: string, entries: DirEntry[]): Promise<DirEntryWithChildren[]> {
  const results: DirEntryWithChildren[] = [];

  for (const entry of entries) {
    const entryPath = await join(parentPath, entry.name);
    const children = entry.isDirectory ? await processEntriesRecursively(entryPath, await readDir(entryPath)) : [];

    results.push({
      ...entry,
      path: entryPath,
      children,
    });
  }

  return results;
}
