import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MetadataSummary } from '../lib/preview';
import { MetadataPanel } from './MetadataPanel';

function renderPanel(fields: Record<string, string>, fieldSamples?: Record<string, string>): string {
  const meta: MetadataSummary = {
    clean: false,
    fieldCount: Object.keys(fields).length,
    fields,
    fieldSamples,
  };

  return renderToStaticMarkup(<MetadataPanel title="Metadata" meta={meta} variant="before" />);
}

describe('MetadataPanel', () => {
  it('keeps definition-list semantics for metadata rows', () => {
    const markup = renderPanel({ GreenMatrixColumn: '1 0 0', Artist: 'Ada Lovelace' });

    expect(markup).toContain('<dl>');
    expect(markup).toContain('<dt>GreenMatrixColumn</dt>');
    expect(markup).toContain('<dd>1 0 0</dd>');
    expect(markup).toContain('<dt>Artist</dt>');
    expect(markup).toContain('<dd>Ada Lovelace</dd>');
  });

  it('shows binary summary with a closed native sample disclosure and full capped sample', () => {
    const sample = 'Uint8Array(4) [0, 1, 2, 255]';
    const markup = renderPanel({ Bytes: 'Uint8Array · 4 values' }, { Bytes: sample });

    expect(markup).toContain('Uint8Array · 4 values');
    expect(markup).toContain('<details class="meta__disclosure">');
    expect(markup).not.toContain('<details class="meta__disclosure" open="">');
    expect(markup).toContain('View sample');
    expect(markup).toContain('Hide sample');
    expect(markup).toContain(sample);
  });

  it('ignores inherited samples for special field keys', () => {
    const fields = Object.fromEntries([
      ['__proto__', 'ordinary value'],
      ['Bytes', 'Uint8Array · 2 values'],
    ]);
    const fieldSamples = { Bytes: 'Uint8Array(2) [0, 1]' };
    let markup = '';

    expect(() => {
      markup = renderPanel(fields, fieldSamples);
    }).not.toThrow();
    expect(markup).toContain('<dt>__proto__</dt><dd>ordinary value</dd>');
    expect(markup.match(/<details class="meta__disclosure">/g)).toHaveLength(1);
  });

  it('renders an own sample for a special field key', () => {
    const fields = Object.fromEntries([['__proto__', 'Uint8Array · 2 values']]);
    const fieldSamples = Object.fromEntries([['__proto__', 'Uint8Array(2) [0, 1]']]);
    const markup = renderPanel(fields, fieldSamples);

    expect(markup).toContain('<dt>__proto__</dt>');
    expect(markup).toContain('View sample');
    expect(markup).toContain('Uint8Array(2) [0, 1]');
  });

  it('keeps exactly 160 structured characters inline', () => {
    const value = `{${'a'.repeat(159)}`;
    const markup = renderPanel({ Regions: value });

    expect(value).toHaveLength(160);
    expect(markup).toContain(`<dd>${value}</dd>`);
    expect(markup).not.toContain('View expanded value');
  });

  it('previews 161-character structured values and retains the expanded value', () => {
    const value = `[${'b'.repeat(160)}`;
    const preview = `${value.slice(0, 79)}…`;
    const markup = renderPanel({ Regions: value });

    expect(value).toHaveLength(161);
    expect(preview).toHaveLength(80);
    expect(markup).toContain(preview);
    expect(markup).toContain('View expanded value');
    expect(markup).toContain('Hide expanded value');
    expect(markup).toContain(value);
  });

  it('leaves long ordinary strings inline', () => {
    const value = 'x'.repeat(200);
    const markup = renderPanel({ Description: value });

    expect(markup).toContain(`<dd>${value}</dd>`);
    expect(markup).not.toContain('View expanded value');
  });

  it('escapes preview and full values through React', () => {
    const value = `{"caption":"<script>alert('x')</script> & ${'z'.repeat(150)}"}`;
    const markup = renderPanel({ Regions: value });

    expect(markup).not.toContain('<script>');
    expect(markup).toContain('&lt;script&gt;');
    expect(markup).toContain('&quot;caption&quot;');
    expect(markup).toContain('&#x27;x&#x27;');
    expect(markup).toContain('&amp;');
  });
});
