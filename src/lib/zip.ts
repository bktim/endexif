import { zipSync } from 'fflate';

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Build a ZIP archive in memory. Fine for typical photo batches. */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const input: Record<string, Uint8Array> = {};
  const usedNames = new Set<string>();
  for (const entry of entries) {
    const baseName = entry.name === '__proto__' ? '__proto__-1' : entry.name;
    let name = baseName;
    let suffix = 0;
    while (usedNames.has(name)) {
      suffix += 1;
      name = baseName.replace(/(\.[^.]*)?$/, `-${suffix}$1`);
    }
    usedNames.add(name);
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
