import { useCallback, useMemo, useState } from 'react';
import { DropZone } from './components/DropZone';
import { FileCard } from './components/FileCard';
import { WorldLandDefinition } from './components/GpsMap';
import { readMetadata } from './lib/preview';
import { stripMetadata } from './lib/strip';
import { buildZip, downloadBlob } from './lib/zip';
import { saveWithPicker } from './lib/save';
import type { FileItem } from './types';

const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  tiff: 'image/tiff',
  heic: 'image/heic',
  dng: 'image/x-adobe-dng',
};

let idCounter = 0;

function renderableType(file: File): boolean {
  if (file.type.startsWith('image/')) {
    return !file.type.includes('heic') && !file.type.includes('heif') && !file.type.includes('tiff');
  }
  return false;
}

export default function App() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [preserveOrientation, setPreserveOrientation] = useState(true);
  const [preserveColorProfile, setPreserveColorProfile] = useState(true);
  const [busy, setBusy] = useState(false);

  const addFiles = useCallback((files: File[]) => {
    const accepted = files.filter(
      (f) => f.type.startsWith('image/') || /\.(heic|heif|tiff?|dng|svg|webp|avif)$/i.test(f.name),
    );
    if (!accepted.length) return;

    const newItems: FileItem[] = accepted.map((file) => ({
      id: `f-${++idCounter}`,
      file,
      previewUrl: renderableType(file) ? URL.createObjectURL(file) : null,
      before: null,
      status: 'ready' as const,
    }));
    setItems((prev) => [...prev, ...newItems]);

    // Read metadata previews asynchronously
    for (const item of newItems) {
      readMetadata(item.file).then((meta) => {
        setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, before: meta } : p)));
      });
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const stripItem = useCallback(
    async (item: FileItem) => {
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: 'stripping' as const } : p)));
      try {
        const buffer = await item.file.arrayBuffer();
        const outcome = await stripMetadata(item.file.name, buffer, {
          preserveOrientation,
          preserveColorProfile,
        });
        if (!outcome.ok) {
          setItems((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, status: 'error' as const, error: outcome.error } : p)),
          );
          return;
        }
        const mime = MIME_BY_FORMAT[outcome.format] ?? 'application/octet-stream';
        const cleanedFile = new File([outcome.buffer], item.file.name, { type: mime });
        const after = await readMetadata(cleanedFile);
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? {
                  ...p,
                  status: 'done' as const,
                  result: {
                    buffer: outcome.buffer,
                    format: outcome.format,
                    removedMetadata: outcome.removedMetadata,
                    originalSize: outcome.originalSize,
                    cleanedSize: outcome.cleanedSize,
                  },
                  after,
                }
              : p,
          ),
        );
      } catch (error) {
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? { ...p, status: 'error' as const, error: error instanceof Error ? error.message : String(error) }
              : p,
          ),
        );
      }
    },
    [preserveOrientation, preserveColorProfile],
  );

  const stripAll = useCallback(async () => {
    setBusy(true);
    try {
      const snapshot = items.filter((i) => i.status === 'ready' || i.status === 'error');
      for (const item of snapshot) {
        await stripItem(item);
      }
    } finally {
      setBusy(false);
    }
  }, [items, stripItem]);

  const downloadOne = useCallback((item: FileItem) => {
    if (!item.result) return;
    const mime = MIME_BY_FORMAT[item.result.format] ?? 'application/octet-stream';
    downloadBlob(item.result.buffer, item.file.name, mime);
  }, []);

  const doneItems = useMemo(() => items.filter((i) => i.status === 'done' && i.result), [items]);

  const downloadAll = useCallback(async () => {
    if (!doneItems.length) return;
    if (doneItems.length === 1) {
      downloadOne(doneItems[0]);
      return;
    }
    const zipData = buildZip(
      doneItems.map((i) => ({ name: i.file.name, data: new Uint8Array(i.result!.buffer) })),
    );
    const saved = await saveWithPicker(zipData, 'endexif-clean.zip', 'application/zip');
    if (!saved) downloadBlob(zipData as unknown as BlobPart, 'endexif-clean.zip', 'application/zip');
  }, [doneItems, downloadOne]);

  const pendingCount = items.filter((i) => i.status === 'ready' || i.status === 'error').length;

  return (
    <div className="app">
      <WorldLandDefinition />
      <header className="header">
        <h1>
          End<span className="accent">Exif</span>
        </h1>
        <p className="tagline">Strip photo metadata. Everything stays on your device.</p>
        <ul className="badges">
          <li>100% client-side</li>
          <li>No uploads, ever</li>
          <li>Lossless — pixels untouched</li>
          <li>Open source (MIT)</li>
          <li>Works offline</li>
        </ul>
      </header>

      <main>
        <DropZone onFiles={addFiles} />

        {items.length > 0 && (
          <>
            <div className="toolbar">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={preserveOrientation}
                  onChange={(e) => setPreserveOrientation(e.target.checked)}
                />
                Keep rotation
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={preserveColorProfile}
                  onChange={(e) => setPreserveColorProfile(e.target.checked)}
                />
                Keep color profile
              </label>
              <div className="toolbar__spacer" />
              {pendingCount > 0 && (
                <button className="btn btn--primary" disabled={busy} onClick={stripAll}>
                  {busy ? 'Stripping…' : `Strip ${pendingCount} photo${pendingCount > 1 ? 's' : ''}`}
                </button>
              )}
              {doneItems.length > 0 && (
                <button className="btn btn--primary" onClick={downloadAll}>
                  Download {doneItems.length > 1 ? `all ${doneItems.length} (zip)` : 'clean photo'}
                </button>
              )}
            </div>

            <section className="list">
              {items.map((item) => (
                <FileCard key={item.id} item={item} onDownload={downloadOne} onRemove={removeItem} />
              ))}
            </section>
          </>
        )}
      </main>

      <footer className="footer">
        <p>
          Your photos are processed in a Web Worker on this device. The app enforces{' '}
          <code>connect-src 'none'</code> — the browser itself blocks any network request. Verify:
          open DevTools → Network tab → watch nothing happen.
        </p>
        <p>
          <a href="https://github.com/bktim/endexif" rel="noreferrer">
            Source code
          </a>{' '}
          · MIT License
        </p>
      </footer>
    </div>
  );
}
