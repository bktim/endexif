import { CITIES, type CityEntry } from '../generated/cities';

export interface NearestCity {
  name: string;
  countryName: string;
  distanceKm: number;
  parentName?: string;
}

const EARTH_RADIUS_KM = 6371;

const CITY_CONTEXT: Readonly<Record<string, string>> = {
  'Kreuzberg, DE': 'Berlin',
};

// Build the formatter once. Older runtimes / non-ICU builds may throw or return
// undefined for some region codes; fall back to the raw ISO2 code in that case.
const regionFormatter: Intl.DisplayNames | null = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

function countryName(code: string): string {
  if (regionFormatter) {
    try {
      const name = regionFormatter.of(code);
      if (name) return name;
    } catch {
      // fall through to raw code
    }
  }
  return code;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
  return EARTH_RADIUS_KM * c;
}

function isValidCoord(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Find the nearest city in the embedded CITIES dataset to the given coordinate.
 * Returns null only for invalid input coordinates. For valid coordinates the
 * nearest city is always returned (caller decides whether the distance is
 * useful). Linear scan over ~3500 entries — cheap and fully offline.
 */
export function nearestCity(latitude: number, longitude: number): NearestCity | null {
  if (!isValidCoord(latitude, longitude)) return null;

  let bestDistance = Infinity;
  let bestCity: CityEntry | null = null;

  for (const city of CITIES) {
    const d = haversineKm(latitude, longitude, city.lat, city.lon);
    if (d < bestDistance) {
      bestDistance = d;
      bestCity = city;
    }
  }

  if (!bestCity) return null;

  const result: NearestCity = {
    name: bestCity.name,
    countryName: countryName(bestCity.country),
    distanceKm: Math.round(bestDistance * 10) / 10,
  };
  const parentName = CITY_CONTEXT[`${bestCity.name}, ${bestCity.country}`];
  return parentName ? { ...result, parentName } : result;
}

/**
 * Format a nearest-city result into a human-readable label, or null if the
 * point is too far from any city for a city label to be meaningful (the raw
 * coordinates are already shown by the FileCard in that case).
 *
 *   distanceKm ≤ 50  → "Berlin, Germany"
 *   50 < d ≤ 400     → "Near Berlin, Germany"
 *   d > 400          → null
 */
export function formatLocation(city: NearestCity | null): string | null {
  if (!city) return null;
  const place = city.parentName ? `${city.name} (${city.parentName})` : city.name;
  if (city.distanceKm <= 50) return `${place}, ${city.countryName}`;
  if (city.distanceKm <= 400) return `Near ${place}, ${city.countryName}`;
  return null;
}
