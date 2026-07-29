import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildZip } from './zip';

describe('buildZip', () => {
  it('renames __proto__ deterministically without losing payloads', () => {
    const entries = unzipSync(
      buildZip([
        { name: '__proto__', data: new Uint8Array([1]) },
        { name: '__proto__-1', data: new Uint8Array([2]) },
        { name: '__proto__', data: new Uint8Array([3]) },
      ]),
    );

    expect(Object.keys(entries).sort()).toEqual([
      '__proto__-1',
      '__proto__-1-1',
      '__proto__-1-2',
    ]);
    expect(Object.values(entries).map((data) => data[0]).sort()).toEqual([1, 2, 3]);
  });

  it('preserves all payloads when generated names also collide', () => {
    const entries = unzipSync(
      buildZip([
        { name: 'a.jpg', data: new Uint8Array([1]) },
        { name: 'a.jpg', data: new Uint8Array([2]) },
        { name: 'a-1.jpg', data: new Uint8Array([3]) },
      ]),
    );

    expect(Object.keys(entries).sort()).toEqual(['a-1-1.jpg', 'a-1.jpg', 'a.jpg']);
    expect(Object.values(entries).map((data) => data[0]).sort()).toEqual([1, 2, 3]);
  });
});
