/// <reference lib="webworker" />
import { removeMetadataSync, detectFormat, type RemoveResult } from 'picscrub';

export interface StripRequest {
  id: number;
  name: string;
  buffer: ArrayBuffer;
  preserveOrientation: boolean;
  preserveColorProfile: boolean;
}

export interface StripSuccess {
  id: number;
  ok: true;
  format: string;
  removedMetadata: string[];
  originalSize: number;
  cleanedSize: number;
  buffer: ArrayBuffer;
}

export interface StripFailure {
  id: number;
  ok: false;
  error: string;
}

export type StripResponse = StripSuccess | StripFailure;

self.onmessage = (event: MessageEvent<StripRequest>) => {
  const req = event.data;
  try {
    const input = new Uint8Array(req.buffer);
    const format = detectFormat(input);
    if (format === 'unknown') {
      throw new Error('unrecognized image format');
    }
    const result: RemoveResult = removeMetadataSync(input, {
      preserveOrientation: req.preserveOrientation,
      preserveColorProfile: req.preserveColorProfile,
    });
    // result.data is a fresh Uint8Array — transfer its buffer back zero-copy.
    const out = result.data.buffer.slice(
      result.data.byteOffset,
      result.data.byteOffset + result.data.byteLength,
    ) as ArrayBuffer;
    const response: StripSuccess = {
      id: req.id,
      ok: true,
      format: result.format,
      removedMetadata: result.removedMetadata,
      originalSize: result.originalSize,
      cleanedSize: result.cleanedSize,
      buffer: out,
    };
    (self as unknown as Worker).postMessage(response, [out]);
  } catch (error) {
    const response: StripFailure = {
      id: req.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    (self as unknown as Worker).postMessage(response);
  }
};
