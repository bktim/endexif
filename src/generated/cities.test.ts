import { describe, expect, it } from 'vitest';
import { CITIES } from './cities';

describe('generated cities dataset', () => {
  it('is non-empty', () => {
    expect(CITIES.length).toBeGreaterThan(0);
  });

  it('every entry has a non-empty name and a valid ISO2 country code', () => {
    for (const city of CITIES) {
      expect(city.name.length).toBeGreaterThan(0);
      expect(city.country).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('every entry has in-range coordinates', () => {
    for (const city of CITIES) {
      expect(city.lat).toBeGreaterThanOrEqual(-90);
      expect(city.lat).toBeLessThanOrEqual(90);
      expect(city.lon).toBeGreaterThanOrEqual(-180);
      expect(city.lon).toBeLessThanOrEqual(180);
    }
  });

  it('is sorted deterministically (largest cities first)', () => {
    // The generator sorts population-desc before stripping the field, so
    // globally dominant cities must appear early. Spot-check a known
    // population-desc anchor.
    const shanghai = CITIES.findIndex(
      (c) => c.name === 'Shanghai' && c.country === 'CN',
    );
    expect(shanghai).toBeGreaterThanOrEqual(0);
    expect(shanghai).toBeLessThan(100);
  });
});
