import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  WORLD_BORDER_PATH,
  WORLD_LAND_PATH,
  WORLD_MAP_HEIGHT,
  WORLD_MAP_WIDTH,
} from '../generated/worldLandPath';
import { computeViewBox, GpsMap, projectEquirectangular, WorldLandDefinition } from './GpsMap';

describe('projectEquirectangular', () => {
  it('projects center and world corners', () => {
    expect(projectEquirectangular(0, 0)).toEqual({ x: 180, y: 90 });
    expect(projectEquirectangular(90, -180)).toEqual({ x: 0, y: 0 });
    expect(projectEquirectangular(90, 180)).toEqual({ x: 360, y: 0 });
    expect(projectEquirectangular(-90, -180)).toEqual({ x: 0, y: 180 });
    expect(projectEquirectangular(-90, 180)).toEqual({ x: 360, y: 180 });
  });

  it('projects London fixture', () => {
    expect(projectEquirectangular(51.5074, -0.1278)).toEqual({ x: 179.8722, y: 38.4926 });
  });

  it('rejects invalid coordinates', () => {
    expect(projectEquirectangular(Number.NaN, 0)).toBeNull();
    expect(projectEquirectangular(0, Number.POSITIVE_INFINITY)).toBeNull();
    expect(projectEquirectangular(Number.NEGATIVE_INFINITY, 0)).toBeNull();
    expect(projectEquirectangular(91, 0)).toBeNull();
    expect(projectEquirectangular(-91, 0)).toBeNull();
    expect(projectEquirectangular(0, 181)).toBeNull();
    expect(projectEquirectangular(0, -181)).toBeNull();
  });
});

describe('computeViewBox', () => {
  it('returns a 24x12 window centered on the London point, in-bounds', () => {
    const vb = computeViewBox(51.5074, -0.1278);
    expect(vb).toEqual({ minX: 167.8722, minY: 32.4926, width: 24, height: 12 });
  });

  it('clamps near the top-right edge without shrinking the window', () => {
    const vb = computeViewBox(89, 179);
    expect(vb).not.toBeNull();
    expect(vb!.minX).toBeGreaterThanOrEqual(0);
    expect(vb!.minY).toBeGreaterThanOrEqual(0);
    expect(vb!.minX + vb!.width).toBeLessThanOrEqual(WORLD_MAP_WIDTH);
    expect(vb!.minY + vb!.height).toBeLessThanOrEqual(WORLD_MAP_HEIGHT);
    expect(vb!.width).toBe(24);
    expect(vb!.height).toBe(12);
    // (89,179) projects to (359,1) → window shifts to stay in-bounds.
    expect(vb).toEqual({ minX: 336, minY: 0, width: 24, height: 12 });
  });

  it('clamps near the bottom-left edge', () => {
    const vb = computeViewBox(-89, -179);
    expect(vb).not.toBeNull();
    expect(vb!.minX).toBe(0);
    expect(vb!.minY).toBe(WORLD_MAP_HEIGHT - 12);
    expect(vb!.width).toBe(24);
    expect(vb!.height).toBe(12);
  });

  it('returns null for invalid coordinates', () => {
    expect(computeViewBox(Number.NaN, 0)).toBeNull();
    expect(computeViewBox(91, 0)).toBeNull();
    expect(computeViewBox(0, -181)).toBeNull();
  });
});

describe('GpsMap', () => {
  const londonViewBox = '167.8722 32.4926 24 12';
  const scale = 24 / WORLD_MAP_WIDTH;
  const ringR = 5 * scale;
  const dotR = 2 * scale;
  const strokeWidth = 2 * scale;

  it('renders accessible zoomed SVG map, scaled marker, and city label', () => {
    const markup = renderToStaticMarkup(<GpsMap latitude={51.5074} longitude={-0.1278} />);

    expect(markup).toContain('<figure class="gps-map">');
    expect(markup).toContain(
      `viewBox="${londonViewBox}"`,
    );
    expect(markup).not.toContain(`viewBox="0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}"`);
    expect(markup).toContain('<use class="gps-map__land" href="#endexif-world-land"></use>');
    expect(markup).toContain('<use class="gps-map__borders" href="#endexif-country-borders"></use>');
    expect(markup).toContain('class="gps-map__marker"');
    // Projection math unchanged.
    expect(markup).toContain('transform="translate(179.8722 38.4926)"');
    // City label.
    expect(markup).toContain('London, United Kingdom');
    expect(markup).toContain('<p class="gps-map__location">London, United Kingdom</p>');
    expect(markup).toContain('class="gps-map__place-label"');
    expect(markup).toContain('>London</text>');
    expect(markup).toContain('text-anchor="start"');
    expect(markup.indexOf('gps-map__land')).toBeLessThan(markup.indexOf('gps-map__borders'));
    expect(markup.indexOf('gps-map__borders')).toBeLessThan(
      markup.indexOf('gps-map__place-label'),
    );
    expect(markup.indexOf('gps-map__place-label')).toBeLessThan(
      markup.indexOf('gps-map__marker'),
    );
    // Caption preserved.
    expect(markup).toContain('Approximate location · rendered locally');
    expect(markup).toContain(
      '<figcaption class="gps-map__caption">Approximate location · rendered locally</figcaption>',
    );
    // Label sits above the caption.
    expect(markup.indexOf('gps-map__location')).toBeLessThan(markup.indexOf('gps-map__caption'));
    // Scaled marker radii / stroke width.
    expect(markup).toContain(
      `<circle class="gps-map__marker-ring" r="${ringR}" stroke-width="${strokeWidth}"></circle>`,
    );
    expect(markup).toContain(`<circle class="gps-map__marker-dot" r="${dotR}"></circle>`);
    // Accessibility / no-network / no-color invariants.
    expect(markup).not.toMatch(/(?:fill|stroke)="#[0-9a-f]+"/i);
    expect(markup).not.toContain('<a');
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('http://');
    expect(markup).not.toContain('https://');
  });

  it('renders a contextual Berlin-area city label and a zoomed viewBox', () => {
    const markup = renderToStaticMarkup(<GpsMap latitude={52.51695} longitude={13.35404} />);
    expect(markup).toContain('Kreuzberg (Berlin), Germany');
    expect(markup).toContain('>Kreuzberg (Berlin)</text>');
    expect(markup).toContain('text-anchor="start"');
    expect(markup).toContain('viewBox="181.354 31.4831 24 12"');
  });

  it('renders "Berlin, Germany" for the Berlin city-centre fixture', () => {
    const markup = renderToStaticMarkup(<GpsMap latitude={52.524} longitude={13.411} />);
    expect(markup).toContain('Berlin, Germany');
  });

  it('shares one land path definition across multiple maps', () => {
    const markup = renderToStaticMarkup(
      <>
        <WorldLandDefinition />
        <GpsMap latitude={51.5074} longitude={-0.1278} />
        <GpsMap latitude={52.51695} longitude={13.35404} />
      </>,
    );
    expect(markup.split(WORLD_LAND_PATH)).toHaveLength(2);
    expect(markup.split(WORLD_BORDER_PATH)).toHaveLength(2);
    expect(markup.match(/href="#endexif-world-land"/g)).toHaveLength(2);
    expect(markup.match(/href="#endexif-country-borders"/g)).toHaveLength(2);
  });

  it('keeps boundary markers fully inside the visible viewport', () => {
    const topLeft = renderToStaticMarkup(<GpsMap latitude={90} longitude={-180} />);
    const bottomRight = renderToStaticMarkup(<GpsMap latitude={-90} longitude={180} />);
    expect(topLeft).toContain('transform="translate(0.4 0.4)"');
    expect(bottomRight).toContain('transform="translate(359.6 179.6)"');
  });

  it('anchors a place label inward when the marker is near the right edge', () => {
    const markup = renderToStaticMarkup(<GpsMap latitude={-36.8485} longitude={174.7633} />);

    expect(markup).toContain('>Auckland</text>');
    expect(markup).toContain('text-anchor="end"');
  });

  it('omits the city line when the nearest city is far away', () => {
    // Mid-Pacific point: nearest city is hundreds of km away → no label.
    const markup = renderToStaticMarkup(<GpsMap latitude={0} longitude={-170} />);
    expect(markup).not.toContain('gps-map__location');
    expect(markup).not.toContain('gps-map__place-label');
    expect(markup).toContain('gps-map__caption');
  });

  it('renders null for invalid input', () => {
    expect(renderToStaticMarkup(<GpsMap latitude={Number.NaN} longitude={0} />)).toBe('');
    expect(renderToStaticMarkup(<GpsMap latitude={0} longitude={Number.POSITIVE_INFINITY} />)).toBe('');
    expect(renderToStaticMarkup(<GpsMap latitude={91} longitude={0} />)).toBe('');
  });
});
