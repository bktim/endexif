import { describe, expect, it } from 'vitest';
import { formatLocation, nearestCity } from './geocode';

describe('nearestCity', () => {
  it('returns a near Berlin-area city for Berlin coords with a small distance', () => {
    // The dataset lists Berlin boroughs (Kreuzberg, Neukölln, ...) as separate
    // entries; for these coords Kreuzberg edges out the Berlin entry by ~0.1km.
    const city = nearestCity(52.51695, 13.35404);
    expect(city).not.toBeNull();
    expect(city!.name).toBe('Kreuzberg');
    expect(city!.countryName).toBe('Germany');
    expect(city!.distanceKm).toBeLessThan(10);
    expect(city!.distanceKm).toBeGreaterThanOrEqual(0);
    expect(formatLocation(city)).toBe('Kreuzberg (Berlin), Germany');
  });

  it('returns Berlin for the Berlin city-centre fixture', () => {
    const city = nearestCity(52.524, 13.411);
    expect(city).not.toBeNull();
    expect(city!.name).toBe('Berlin');
    expect(city!.countryName).toBe('Germany');
    expect(city!.distanceKm).toBeLessThan(1);
  });

  it('returns London / United Kingdom for the London fixture', () => {
    const city = nearestCity(51.5074, -0.1278);
    expect(city).not.toBeNull();
    expect(city!.name).toBe('London');
    expect(city!.countryName).toBe('United Kingdom');
    expect(city!.distanceKm).toBeLessThan(5);
  });

  it('returns null for invalid coordinates', () => {
    expect(nearestCity(Number.NaN, 0)).toBeNull();
    expect(nearestCity(0, Number.NaN)).toBeNull();
    expect(nearestCity(91, 0)).toBeNull();
    expect(nearestCity(-91, 0)).toBeNull();
    expect(nearestCity(0, 181)).toBeNull();
    expect(nearestCity(0, -181)).toBeNull();
    expect(nearestCity(Number.POSITIVE_INFINITY, 0)).toBeNull();
  });

  it('returns some city with a large distance for a mid-Pacific point', () => {
    const city = nearestCity(0, -170);
    expect(city).not.toBeNull();
    expect(typeof city!.name).toBe('string');
    expect(city!.name.length).toBeGreaterThan(0);
    expect(typeof city!.countryName).toBe('string');
    expect(city!.countryName.length).toBeGreaterThan(0);
    expect(city!.distanceKm).toBeGreaterThan(400);
  });
});

describe('formatLocation', () => {
  it('formats a near city as "Name, Country"', () => {
    const berlin = nearestCity(52.524, 13.411);
    expect(formatLocation(berlin)).toBe('Berlin, Germany');
  });

  it('returns null for null input', () => {
    expect(formatLocation(null)).toBeNull();
  });

  it('returns null when distance exceeds 400km', () => {
    expect(formatLocation({ name: 'X', countryName: 'Y', distanceKm: 401 })).toBeNull();
  });

  it('uses "Near" prefix for 50–400km', () => {
    expect(formatLocation({ name: 'X', countryName: 'Y', distanceKm: 50.1 })).toBe('Near X, Y');
    expect(formatLocation({ name: 'X', countryName: 'Y', distanceKm: 400 })).toBe('Near X, Y');
  });

  it('uses exact form at the 50km boundary', () => {
    expect(formatLocation({ name: 'X', countryName: 'Y', distanceKm: 50 })).toBe('X, Y');
  });
});
