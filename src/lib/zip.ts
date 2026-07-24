import { zipSync } from 'fflate';

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Build a ZIP archive in memory. Fine for typical photo batches. */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const input: Record<string, Uint8Array> = {};
  const seen = new Map<string, number>();
  for (const entry of entries) {
    // De-dupe file names inside the archive
    const count = seen.get(entry.name) ?? 0;
    seen.set(entry.name, count + 1);
    const name =
      count === 0
        ? entry.name
        : entry.name.replace(/(\.[^.]*)?$/, `-${count}$1`);
    input[name] = entry.data;
  }
  return zipSync(input, { level: 0 }); // already-compressed images: store, don't re-deflate
}

/** Trigger a browser download for in-memory data. */
export function downloadBlob(data: BlobPart, name: string, type: string): void {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
