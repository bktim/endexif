/**
 * Minimal File System Access API types (not yet in all TS dom libs).
 */
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}

interface FileSystemWritableHandleLike {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableHandleLike>;
}

interface WindowWithPicker {
  showSaveFilePicker?: (options: SaveFilePickerOptions) => Promise<FileSystemFileHandleLike>;
}

/** True when the File System Access API save picker exists (Chromium). */
export function hasSaveFilePicker(): boolean {
  return typeof (window as unknown as WindowWithPicker).showSaveFilePicker === 'function';
}

/**
 * Save data via the native save picker. Returns false when the API is
 * unavailable or the user cancelled — callers should fall back to a
 * blob download in that case.
 */
export async function saveWithPicker(
  data: Uint8Array,
  suggestedName: string,
  mime: string,
): Promise<boolean> {
  const picker = (window as unknown as WindowWithPicker).showSaveFilePicker;
  if (!picker) return false;
  try {
    const handle = await picker({
      suggestedName,
      types: [{ description: suggestedName, accept: { [mime]: [] } }],
    });
    const writable = await handle.createWritable();
    // Blob wrapper avoids SharedArrayBuffer/typed-array generic friction
    await writable.write(new Blob([data as BlobPart], { type: mime }));
    await writable.close();
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return true; // user cancelled = handled
    return false;
  }
}
