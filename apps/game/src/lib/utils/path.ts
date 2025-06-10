export function folderName(path: string) {
  const unixPath = path.replace(/\\/g, "/");
  const name = unixPath.split("/").pop();
  return name || "Unknown";
}
