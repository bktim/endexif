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
const pending = new Map<
  number,
  {
    resolve: (response: StripResponse) => void;
    reject: (error: Error) => void;
  }
>();

function failWorker(failedWorker: Worker, error: Error): void {
  if (worker !== failedWorker) return;
  worker = null;
  failedWorker.terminate();
  for (const request of pending.values()) request.reject(error);
  pending.clear();
}

function getWorker(): Worker {
  if (!worker) {
    const createdWorker = new Worker(new URL('../worker/strip.worker.ts', import.meta.url), {
      type: 'module',
    });
    createdWorker.onmessage = (event: MessageEvent<StripResponse>) => {
      const request = pending.get(event.data.id);
      if (request) {
        pending.delete(event.data.id);
        request.resolve(event.data);
      }
    };
    createdWorker.onerror = (event) => {
      const error = event.error instanceof Error ? event.error : new Error(event.message || 'Image worker failed');
      failWorker(createdWorker, error);
    };
    createdWorker.onmessageerror = () => {
      failWorker(createdWorker, new Error('Image worker response could not be read'));
    };
    worker = createdWorker;
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
  return new Promise((resolve, reject) => {
    pending.set(id, {
      resolve: (response) => {
        if (response.ok) {
          const { format, removedMetadata, originalSize, cleanedSize, buffer: out } = response;
          resolve({ ok: true, format, removedMetadata, originalSize, cleanedSize, buffer: out });
        } else {
          resolve({ ok: false, error: response.error });
        }
      },
      reject,
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
