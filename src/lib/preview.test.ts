import { beforeEach, describe, expect, it, vi } from 'vitest';

const { parseMock } = vi.hoisted(() => ({
  parseMock: vi.fn(),
}));

vi.mock('exifr', () => ({
  default: { parse: parseMock },
}));

import { readMetadata } from './preview';

describe('readMetadata', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it('retains every parsed top-level field and counts only displayed fields', async () => {
    const parsed = Object.fromEntries([
      ['Make', 'Acme'],
      ['UnlistedTag', 'retained'],
      ['StructuredTag', ['one', { two: 2 }]],
      ['__proto__', 'metadata value'],
    ]);
    parseMock.mockResolvedValue(parsed);

    const summary = await readMetadata(new Blob());

    expect(summary.fields).toEqual(
      Object.fromEntries([
        ['Make', 'Acme'],
        ['UnlistedTag', 'retained'],
        ['StructuredTag', '["one", {"two": 2}]'],
        ['__proto__', 'metadata value'],
      ]),
    );
    expect(Object.hasOwn(summary.fields, '__proto__')).toBe(true);
    expect(summary.fieldCount).toBe(Object.keys(summary.fields).length);
    expect(summary.fieldCount).toBe(4);
  });

  it('safely formats supported scalar and structured metadata values', async () => {
    const longText = 'x'.repeat(250);
    const circular: Record<string, unknown> = { label: 'root' };
    circular.self = circular;
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    function sampleHandler() {}
    const topLevelBytes20 = new Uint8Array(20).map((_, index) => index);
    const topLevelBytes1 = new Uint8Array([7]);
    const topLevelBytes0 = new Uint8Array(0);

    parseMock.mockResolvedValue({
      CapturedAt: new Date('2024-01-02T03:04:05.000Z'),
      InvalidDate: new Date(Number.NaN),
      LongText: longText,
      Values: ['alpha', 2, null, undefined, 3n, Symbol('token'), sampleHandler],
      Nested: { enabled: true, child: { name: 'camera' } },
      Bytes: topLevelBytes20,
      OneByte: topLevelBytes1,
      NoBytes: topLevelBytes0,
      NestedBytes: { bytes: new Uint8Array(20).map((_, index) => index) },
      BufferView: new DataView(new ArrayBuffer(8)),
      Empty: null,
      Missing: undefined,
      LargeNumber: 9_007_199_254_740_993n,
      Marker: Symbol('secret'),
      Callback: sampleHandler,
      Circular: circular,
      Make: proxy,
    });

    const summary = await readMetadata(new Blob());

    expect(summary.fields).toEqual({
      CapturedAt: '2024-01-02T03:04:05.000Z',
      InvalidDate: 'Invalid Date',
      LongText: longText,
      Values:
        '["alpha", 2, null, undefined, 3n, Symbol(token), [Function sampleHandler]]',
      Nested: '{"enabled": true, "child": {"name": "camera"}}',
      Bytes: 'Uint8Array · 20 values',
      OneByte: 'Uint8Array · 1 value',
      NoBytes: 'Uint8Array · 0 values',
      NestedBytes: '{"bytes": Uint8Array(20) [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, …]}',
      BufferView: 'DataView(8 bytes)',
      Empty: 'null',
      Missing: 'undefined',
      LargeNumber: '9007199254740993n',
      Marker: 'Symbol(secret)',
      Callback: '[Function sampleHandler]',
      Circular: '{"label": "root", "self": [Circular]}',
      Make: '[Unserializable]',
    });
    expect(summary.fieldSamples).toEqual({
      Bytes: 'Uint8Array(20) [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, …]',
      OneByte: 'Uint8Array(1) [7]',
      NoBytes: 'Uint8Array(0) []',
    });
    expect(summary.fieldSamples?.Bytes).not.toBe(summary.fields.Bytes);
    expect(Object.values(summary.fieldSamples ?? {}).every((value) => typeof value === 'string')).toBe(true);
    expect(summary.camera).toBeUndefined();
    expect(summary.fields.LongText).toHaveLength(250);
    expect(summary.fields.Bytes).toBe('Uint8Array · 20 values');
    expect(summary.fields.OneByte).toBe('Uint8Array · 1 value');
    expect(summary.fields.NoBytes).toBe('Uint8Array · 0 values');
    expect(summary.fields.NestedBytes).toContain('Uint8Array(20) [0, 1, 2, 3');
    expect(summary.fields.BufferView).toBe('DataView(8 bytes)');
    expect(summary.fieldCount).toBe(Object.keys(summary.fields).length);
  });

  it('keeps typed-array samples safe for special field keys', async () => {
    parseMock.mockResolvedValue(
      Object.fromEntries([
        ['__proto__', new Uint8Array([1, 2, 3])],
        ['constructor', new Uint8Array([4, 5, 6, 7])],
        ['', new Uint8Array(0)],
        ['ordinary', new Uint8Array([8, 9])],
      ]),
    );

    const summary = await readMetadata(new Blob());

    expect(summary.fields).toEqual(
      Object.fromEntries([
        ['__proto__', 'Uint8Array · 3 values'],
        ['constructor', 'Uint8Array · 4 values'],
        ['', 'Uint8Array · 0 values'],
        ['ordinary', 'Uint8Array · 2 values'],
      ]),
    );
    expect(summary.fieldSamples).toEqual(
      Object.fromEntries([
        ['__proto__', 'Uint8Array(3) [1, 2, 3]'],
        ['constructor', 'Uint8Array(4) [4, 5, 6, 7]'],
        ['', 'Uint8Array(0) []'],
        ['ordinary', 'Uint8Array(2) [8, 9]'],
      ]),
    );
    expect(Object.getPrototypeOf(summary.fieldSamples)).toBe(null);
    expect(Object.prototype.hasOwnProperty.call(summary.fieldSamples, 'toString')).toBe(false);
    expect(summary.fieldCount).toBe(4);
    expect(Object.keys(summary.fields)).toHaveLength(4);
  });

  it('preserves GPS, camera, capture date, and software summaries', async () => {
    parseMock.mockResolvedValue({
      latitude: 51.5,
      longitude: -0.12,
      Make: 'Acme',
      Model: 'Model One',
      DateTimeOriginal: new Date('2023-04-05T06:07:08.000Z'),
      Software: 'Photo Tool',
    });

    const summary = await readMetadata(new Blob());

    expect(summary.gps).toEqual({ latitude: 51.5, longitude: -0.12 });
    expect(summary.camera).toBe('Acme Model One');
    expect(summary.takenAt).toBe('2023-04-05T06:07:08.000Z');
    expect(summary.software).toBe('Photo Tool');
    expect(summary.fieldCount).toBe(6);
    expect(Object.keys(summary.fields)).toHaveLength(6);
  });

  it('bounds output length, collection items, and nesting depth', async () => {
    const wideObject = Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [`key${index}`, index]),
    );
    parseMock.mockResolvedValue({
      LongText: 'x'.repeat(5_000),
      WideArray: Array.from({ length: 101 }, (_, index) => index),
      WideObject: wideObject,
      TooDeep: {
        level1: {
          level2: {
            level3: { level4: { level5: { level6: 'hidden' } } },
          },
        },
      },
    });

    const summary = await readMetadata(new Blob());

    expect(summary.fields.LongText).toHaveLength(4_096);
    expect(summary.fields.LongText).toMatch(/… \[truncated\]$/);
    expect(summary.fields.WideArray).toMatch(/, 99, … 1 item omitted\]$/);
    expect(summary.fields.WideObject).toContain('"key99": 99');
    expect(summary.fields.WideObject).not.toContain('"key100"');
    expect(summary.fields.WideObject).toMatch(/, … 1 item omitted}$/);
    expect(summary.fields.TooDeep).toBe(
      '{"level1": {"level2": {"level3": {"level4": {"level5": [Depth limit 5 reached]}}}}}',
    );
    expect(Object.values(summary.fields).every((value) => value.length <= 4_096)).toBe(
      true,
    );
  });

  it('treats empty and diagnostics-only parser output as clean', async () => {
    parseMock.mockResolvedValueOnce({});

    await expect(readMetadata(new Blob())).resolves.toEqual({
      clean: true,
      fieldCount: 0,
      fields: {},
    });

    parseMock.mockResolvedValueOnce({ errors: [new Error('bad EXIF')] });

    await expect(readMetadata(new Blob())).resolves.toEqual({
      clean: true,
      fieldCount: 0,
      fields: {},
    });

    parseMock.mockResolvedValueOnce({ errors: ['warning'], Make: 'Acme' });
    const summary = await readMetadata(new Blob());

    expect(summary.clean).toBe(false);
    expect(summary.fieldCount).toBe(1);
    expect(summary.fields).toEqual({ Make: 'Acme' });
    expect(summary.camera).toBe('Acme');
  });

  it('resolves cleanly for hostile top-level parser output', async () => {
    const clean = { clean: true, fieldCount: 0, fields: {} };
    const hostileKeys = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('blocked ownKeys');
        },
      },
    );
    const hostileGetter = Object.defineProperty({}, 'Bad', {
      enumerable: true,
      get() {
        throw new Error('blocked getter');
      },
    });
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();

    parseMock.mockResolvedValueOnce(hostileKeys);
    await expect(readMetadata(new Blob())).resolves.toEqual(clean);

    parseMock.mockResolvedValueOnce(hostileGetter);
    await expect(readMetadata(new Blob())).resolves.toEqual(clean);

    parseMock.mockImplementationOnce(() => proxy);
    await expect(readMetadata(new Blob())).resolves.toEqual(clean);
  });

  it('does not cap ordinary top-level metadata fields', async () => {
    const parsed = Object.fromEntries(
      Array.from({ length: 150 }, (_, index) => [`Field${index}`, index]),
    );
    parseMock.mockResolvedValue(parsed);

    const summary = await readMetadata(new Blob());

    expect(summary.clean).toBe(false);
    expect(summary.fieldCount).toBe(150);
    expect(Object.keys(summary.fields)).toHaveLength(150);
    expect(summary.fields.Field149).toBe('149');
  });
});
