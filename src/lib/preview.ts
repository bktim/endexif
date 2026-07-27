import exifr from 'exifr';

export interface MetadataSummary {
  /** true when no recognizable metadata was found at all */
  clean: boolean;
  /** GPS latitude/longitude if present */
  gps?: { latitude: number; longitude: number };
  camera?: string;
  takenAt?: string;
  software?: string;
  /** number of parsed metadata keys */
  fieldCount: number;
  /** parsed output converted to safe display strings */
  fields: Record<string, string>;
  fieldSamples?: Record<string, string>;
}

const TYPED_ARRAY_SAMPLE_SIZE = 16;
const MAX_DEPTH = 5;
const MAX_COLLECTION_ITEMS = 100;
const MAX_OUTPUT_LENGTH = 4_096;
const OUTPUT_TRUNCATION_MARKER = '… [truncated]';

function quote(value: string): string {
  return JSON.stringify(value) ?? '""';
}

function truncateOutput(value: string): string {
  if (value.length <= MAX_OUTPUT_LENGTH) return value;
  return `${value.slice(
    0,
    MAX_OUTPUT_LENGTH - OUTPUT_TRUNCATION_MARKER.length,
  )}${OUTPUT_TRUNCATION_MARKER}`;
}

function omittedMarker(count: number): string {
  return `… ${count} ${count === 1 ? 'item' : 'items'} omitted`;
}

function formatTypedArraySample(
  value: ArrayBufferView & ArrayLike<unknown>,
  ancestors: Set<object>,
  depth: number,
): string {
  const size = value.length;
  const sampleSize = Math.min(size, TYPED_ARRAY_SAMPLE_SIZE);
  const sample = Array.from({ length: sampleSize }, (_, index) =>
    toDisplay(value[index], ancestors, true, depth + 1),
  );
  if (size > sampleSize) sample.push('…');
  return `${value.constructor.name}(${size}) [${sample.join(', ')}]`;
}

function formatDisplay(
  value: unknown,
  ancestors: Set<object>,
  nested: boolean,
  depth: number,
  fieldSamples?: Record<string, string>,
  fieldKey?: string,
): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  switch (typeof value) {
    case 'string':
      return nested ? quote(value) : value;
    case 'number':
    case 'boolean':
      return String(value);
    case 'bigint':
      return `${value}n`;
    case 'symbol':
      return String(value);
    case 'function':
      return `[Function ${value.name || 'anonymous'}]`;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  }

  if (ArrayBuffer.isView(value)) {
    if (value instanceof DataView) return `DataView(${value.byteLength} bytes)`;

    const typed = value as ArrayBufferView & ArrayLike<unknown>;
    if (!nested) {
      if (fieldSamples && fieldKey !== undefined) {
        fieldSamples[fieldKey] = truncateOutput(
          formatTypedArraySample(typed, ancestors, depth),
        );
      }
      const size = typed.length;
      return `${value.constructor.name} · ${size} ${size === 1 ? 'value' : 'values'}`;
    }
    return formatTypedArraySample(typed, ancestors, depth);
  }

  if (ancestors.has(value)) return '[Circular]';
  if (depth >= MAX_DEPTH) return `[Depth limit ${MAX_DEPTH} reached]`;
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const itemCount = Math.min(value.length, MAX_COLLECTION_ITEMS);
      const items = Array.from({ length: itemCount }, (_, index) =>
        toDisplay(value[index], ancestors, true, depth + 1, fieldSamples),
      );
      if (value.length > itemCount) {
        items.push(omittedMarker(value.length - itemCount));
      }
      return `[${items.join(', ')}]`;
    }

    const entries = Object.entries(value);
    const itemCount = Math.min(entries.length, MAX_COLLECTION_ITEMS);
    const items = entries
      .slice(0, itemCount)
      .map(
        ([key, item]) =>
          `${quote(key)}: ${toDisplay(item, ancestors, true, depth + 1, fieldSamples)}`,
      );
    if (entries.length > itemCount) {
      items.push(omittedMarker(entries.length - itemCount));
    }
    return `{${items.join(', ')}}`;
  } finally {
    ancestors.delete(value);
  }
}

function toDisplay(
  value: unknown,
  ancestors = new Set<object>(),
  nested = false,
  depth = 0,
  fieldSamples?: Record<string, string>,
  fieldKey?: string,
): string {
  try {
    return truncateOutput(
      formatDisplay(value, ancestors, nested, depth, fieldSamples, fieldKey),
    );
  } catch {
    return '[Unserializable]';
  }
}

function toSummaryDisplay(value: unknown): string | null {
  try {
    if (
      value != null &&
      (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value instanceof Date)
    ) {
      return toDisplay(value);
    }
  } catch {
    return null;
  }
  return null;
}

/** Parse metadata for the before/after preview. Read-only, fast. */
export async function readMetadata(file: File | Blob): Promise<MetadataSummary> {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = (await exifr.parse(file, {
      gps: true,
      xmp: true,
      iptc: true,
      icc: true,
      translateValues: true,
      reviveValues: true,
    })) as Record<string, unknown> | null;
  } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return { clean: true, fieldCount: 0, fields: {} };
  }

  let entries: [string, unknown][];
  try {
    entries = Object.entries(parsed).filter(([key]) => key !== 'errors');
  } catch {
    return { clean: true, fieldCount: 0, fields: {} };
  }

  if (entries.length === 0) {
    return { clean: true, fieldCount: 0, fields: {} };
  }

  const normalized = Object.fromEntries(entries);
  const fieldSamples: Record<string, string> = Object.create(null);
  const fields = Object.fromEntries(
    entries.map(([key, value]) => [key, toDisplay(value, undefined, false, 0, fieldSamples, key)]),
  );

  const summary: MetadataSummary = {
    clean: false,
    fieldCount: entries.length,
    fields,
  };
  if (Object.keys(fieldSamples).length > 0) summary.fieldSamples = fieldSamples;

  const lat = normalized.latitude;
  const lon = normalized.longitude;
  if (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  ) {
    summary.gps = { latitude: lat, longitude: lon };
  }
  const make = toSummaryDisplay(normalized.Make);
  const model = toSummaryDisplay(normalized.Model);
  if (make || model) summary.camera = [make, model].filter(Boolean).join(' ');
  const taken =
    toSummaryDisplay(normalized.DateTimeOriginal) ??
    toSummaryDisplay(normalized.CreateDate);
  if (taken) summary.takenAt = taken;
  const software = toSummaryDisplay(normalized.Software);
  if (software) summary.software = software;

  return summary;
}
