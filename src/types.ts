import type { MetadataSummary } from './lib/preview';

export type FileStatus = 'ready' | 'stripping' | 'done' | 'error';

export interface StripResult {
  buffer: ArrayBuffer;
  format: string;
  removedMetadata: string[];
  originalSize: number;
  cleanedSize: number;
}

export interface FileItem {
  id: string;
  file: File;
  /** object URL for thumbnail, null when the browser can't render the format */
  previewUrl: string | null;
  before: MetadataSummary | null;
  status: FileStatus;
  result?: StripResult;
  after?: MetadataSummary | null;
  error?: string;
}
