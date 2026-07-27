import { describe, expect, it } from 'vitest';
import {
  WORLD_BORDER_PATH,
  WORLD_LAND_PATH,
  WORLD_MAP_HEIGHT,
  WORLD_MAP_WIDTH,
} from './worldLandPath';

describe('generated world land path', () => {
  it('exports the map dimensions and a nonempty path', () => {
    expect(WORLD_MAP_WIDTH).toBe(360);
    expect(WORLD_MAP_HEIGHT).toBe(180);
    expect(WORLD_LAND_PATH.length).toBeGreaterThan(0);
    expect(WORLD_BORDER_PATH.length).toBeGreaterThan(0);
  });
});
