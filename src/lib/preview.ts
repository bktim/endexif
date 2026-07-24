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
  /** raw parsed output, trimmed to displayable primitives */
  fields: Record<string, string>;
}

const INTERESTING = [
  'Make',
  'Model',
  'LensModel',
  'DateTimeOriginal',
  'CreateDate',
  'Software',
  'Artist',
  'Copyright',
  'ImageDescription',
  'UserComment',
  'ExposureTime',
  'FNumber',
  'ISO',
  'FocalLength',
  'SerialNumber',
  'OwnerName',
] as const;

function toDisplay(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value.slice(0, 200);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
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

  const fields: Record<string, string> = {};
  for (const key of INTERESTING) {
    const display = toDisplay(parsed[key]);
    if (display !== null) fields[key] = display;
  }

  const summary: MetadataSummary = {
    clean: false,
    fieldCount: Object.keys(parsed).length,
    fields,
  };

  const lat = parsed.latitude;
  const lon = parsed.longitude;
  if (typeof lat === 'number' && typeof lon === 'number') {
    summary.gps = { latitude: lat, longitude: lon };
  }
  const make = toDisplay(parsed.Make);
  const model = toDisplay(parsed.Model);
  if (make || model) summary.camera = [make, model].filter(Boolean).join(' ');
  const taken = toDisplay(parsed.DateTimeOriginal) ?? toDisplay(parsed.CreateDate);
  if (taken) summary.takenAt = taken;
  const software = toDisplay(parsed.Software);
  if (software) summary.software = software;

  return summary;
}
