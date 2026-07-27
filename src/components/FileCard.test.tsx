import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { FileItem } from '../types';
import { FileCard } from './FileCard';

function renderCard(item: FileItem): string {
  return renderToStaticMarkup(
    <FileCard item={item} onDownload={vi.fn()} onRemove={vi.fn()} />,
  );
}

function makeItem(overrides: Partial<FileItem> = {}): FileItem {
  return {
    id: 'photo-1',
    file: { name: 'photo.jpg', size: 2048 } as File,
    previewUrl: null,
    before: null,
    status: 'ready',
    ...overrides,
  };
}

describe('FileCard', () => {
  it('renders ready GPS warning, static map, summary, and disclosure in order', () => {
    const markup = renderCard(
      makeItem({
        before: {
          clean: false,
          fieldCount: 2,
          camera: 'Fujifilm X-T5',
          gps: { latitude: 51.5074, longitude: -0.1278 },
          fields: { Make: 'Fujifilm', GPSLatitude: '51.5074' },
        },
      }),
    );

    const warning = 'Contains GPS location: 51.50740, -0.12780';
    const caption = 'Approximate location · rendered locally';
    const summary = '2 metadata fields — Fujifilm X-T5';
    const disclosure = 'View all 2 metadata fields';

    expect(markup).toContain(warning);
    expect(markup).toContain('<figure class="gps-map">');
    expect(markup).toContain(caption);
    expect(markup.indexOf(warning)).toBeLessThan(markup.indexOf('<figure class="gps-map">'));
    expect(markup.indexOf(caption)).toBeLessThan(markup.indexOf(summary));
    expect(markup.indexOf(summary)).toBeLessThan(markup.indexOf(disclosure));
  });

  it('does not render a map for a ready card without GPS', () => {
    const markup = renderCard(
      makeItem({
        before: {
          clean: false,
          fieldCount: 1,
          fields: { Artist: 'Ada Lovelace' },
        },
      }),
    );

    expect(markup).not.toContain('<figure class="gps-map">');
    expect(markup).not.toContain('Approximate location · rendered locally');
  });

  it('keeps ready metadata fields unmounted while disclosure is closed', () => {
    const markup = renderCard(
      makeItem({
        before: {
          clean: false,
          fieldCount: 2,
          camera: 'Fujifilm X-T5',
          fields: {
            VeryLongMetadataFieldNameThatNeedsToWrap: 'Uint8Array · 4 values',
            Artist: 'Ada Lovelace',
          },
          fieldSamples: {
            VeryLongMetadataFieldNameThatNeedsToWrap: 'Uint8Array(4) [0, 1, 2, 255]',
          },
        },
      }),
    );

    expect(markup).toContain('<details class="card__metadata">');
    expect(markup).toContain(
      '<summary class="card__metadata-summary">View all 2 metadata fields</summary>',
    );
    expect(markup).not.toContain('<details class="card__metadata" open="">');
    expect(markup).not.toContain('<dl>');
    expect(markup).not.toContain('<dt>VeryLongMetadataFieldNameThatNeedsToWrap</dt>');
    expect(markup).not.toContain('<dd>Uint8Array · 4 values</dd>');
    expect(markup).not.toContain('Uint8Array(4) [0, 1, 2, 255]');
  });

  it('does not render metadata disclosure for a clean ready card', () => {
    const markup = renderCard(
      makeItem({ before: { clean: true, fieldCount: 0, fields: {} } }),
    );

    expect(markup).not.toContain('<details');
    expect(markup).not.toContain('View all');
    expect(markup).not.toContain('<figure class="gps-map">');
    expect(markup).not.toContain('Approximate location · rendered locally');
  });

  it('preserves done-state before and after behavior', () => {
    const markup = renderCard(
      makeItem({
        status: 'done',
        before: {
          clean: false,
          fieldCount: 1,
          gps: { latitude: 51.5074, longitude: -0.1278 },
          fields: { Artist: 'Ada Lovelace' },
        },
        result: {
          buffer: new ArrayBuffer(1),
          format: 'jpeg',
          removedMetadata: ['EXIF'],
          originalSize: 2048,
          cleanedSize: 1024,
        },
        after: { clean: true, fieldCount: 0, fields: {} },
      }),
    );

    expect(markup).toContain('Show before / after');
    expect(markup).not.toContain('View all 1 metadata fields');
    expect(markup).not.toContain('<figure class="gps-map">');
    expect(markup).not.toContain('Approximate location · rendered locally');
  });
});
