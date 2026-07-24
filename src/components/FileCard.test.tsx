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
  it('keeps ready metadata fields unmounted while disclosure is closed', () => {
    const markup = renderCard(
      makeItem({
        before: {
          clean: false,
          fieldCount: 2,
          camera: 'Fujifilm X-T5',
          fields: {
            VeryLongMetadataFieldNameThatNeedsToWrap: 'A long metadata value that must remain readable',
            Artist: 'Ada Lovelace',
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
    expect(markup).not.toContain('<dd>A long metadata value that must remain readable</dd>');
  });

  it('does not render metadata disclosure for a clean ready card', () => {
    const markup = renderCard(
      makeItem({ before: { clean: true, fieldCount: 0, fields: {} } }),
    );

    expect(markup).not.toContain('<details');
    expect(markup).not.toContain('View all');
  });

  it('preserves done-state before and after behavior', () => {
    const markup = renderCard(
      makeItem({
        status: 'done',
        before: {
          clean: false,
          fieldCount: 1,
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
  });
});
