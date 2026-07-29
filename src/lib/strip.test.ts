import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StripRequest, StripResponse } from '../worker/strip.worker';

class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent<StripResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  readonly posted: StripRequest[] = [];
  readonly terminate = vi.fn();

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: StripRequest): void {
    this.posted.push(message);
  }

  emitError(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }

  emitMessage(response: StripResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<StripResponse>);
  }
}

describe('stripMetadata', () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects pending work and creates a fresh worker after a fatal error', async () => {
    const { stripMetadata } = await import('./strip');
    const options = { preserveOrientation: true, preserveColorProfile: true };

    const firstRequest = stripMetadata('first.jpg', new ArrayBuffer(1), options);
    const firstWorker = FakeWorker.instances[0];
    firstWorker.emitError('fatal worker error');

    await expect(firstRequest).rejects.toThrow('fatal worker error');
    expect(firstWorker.terminate).toHaveBeenCalledOnce();

    const secondRequest = stripMetadata('second.jpg', new ArrayBuffer(1), options);
    const secondWorker = FakeWorker.instances[1];
    expect(secondWorker).not.toBe(firstWorker);

    const id = secondWorker.posted[0].id;
    const output = new ArrayBuffer(2);
    secondWorker.emitMessage({
      id,
      ok: true,
      format: 'jpeg',
      removedMetadata: ['EXIF'],
      originalSize: 3,
      cleanedSize: 2,
      buffer: output,
    });

    await expect(secondRequest).resolves.toEqual({
      ok: true,
      format: 'jpeg',
      removedMetadata: ['EXIF'],
      originalSize: 3,
      cleanedSize: 2,
      buffer: output,
    });
  });
});
