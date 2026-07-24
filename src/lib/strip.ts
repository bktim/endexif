import type { StripRequest, StripResponse, StripSuccess } from '../worker/strip.worker';

export interface StripOptions {
  preserveOrientation: boolean;
  preserveColorProfile: boolean;
}

export type StripOutcome =
  | ({ ok: true } & Omit<StripSuccess, 'id' | 'ok'>)
  | { ok: false; error: string };

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, (response: StripResponse) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../worker/strip.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<StripResponse>) => {
      const resolve = pending.get(event.data.id);
      if (resolve) {
        pending.delete(event.data.id);
        resolve(event.data);
      }
    };
  }
  return worker;
}

/**
 * Strip metadata from an image inside a Web Worker.
 * The input buffer is transferred (not copied) and becomes detached —
 * callers must not reuse it afterwards.
 */
export function stripMetadata(
  name: string,
  buffer: ArrayBuffer,
  options: StripOptions,
): Promise<StripOutcome> {
  const w = getWorker();
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, (response) => {
      if (response.ok) {
        const { format, removedMetadata, originalSize, cleanedSize, buffer: out } = response;
        resolve({ ok: true, format, removedMetadata, originalSize, cleanedSize, buffer: out });
      } else {
        resolve({ ok: false, error: response.error });
      }
    });
    const request: StripRequest = {
      id,
      name,
      buffer,
      preserveOrientation: options.preserveOrientation,
      preserveColorProfile: options.preserveColorProfile,
    };
    w.postMessage(request, [buffer]);
  });
}
