export function formatPath(absolutePath: string) {
  const normalized = absolutePath.replace(/\//g, "\\");
  const windowsMatch = normalized.match(/^([A-Za-z]:\\Users\\[^\\]+\\)(OneDrive\\)?(.*)$/i);

  if (windowsMatch) {
    return `~/${windowsMatch[3].replace(/\\/g, "/")}`;
  }

  const macMatch = absolutePath.match(/^\/Users\/[^/]+\/(.*)$/);
  if (macMatch) {
    const trimmed = macMatch[1].replace(/^OneDrive\//, "");
    return `~/${trimmed}`;
  }

  const linuxMatch = absolutePath.match(/^\/home\/[^/]+\/(.*)$/);
  if (linuxMatch) {
    const trimmed = linuxMatch[1].replace(/^OneDrive\//, "");
    return `~/${trimmed}`;
  }

  return absolutePath;
}
