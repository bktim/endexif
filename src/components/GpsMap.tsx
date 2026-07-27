import {
  WORLD_BORDER_PATH,
  WORLD_LAND_PATH,
  WORLD_MAP_HEIGHT,
  WORLD_MAP_WIDTH,
} from '../generated/worldLandPath';
import { formatLocation, nearestCity } from '../lib/geocode';

export interface GpsPoint {
  x: number;
  y: number;
}

export interface ViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

interface Props {
  latitude: number;
  longitude: number;
}

const CAPTION = 'Approximate location · rendered locally';
const WORLD_LAND_ID = 'endexif-world-land';
const COUNTRY_BORDERS_ID = 'endexif-country-borders';

// Zoom window: a small, recognizable region around the point. Wide enough that
// coastlines and country shapes remain identifiable after the Natural Earth
// 1:50m path is re-projected into this viewBox.
const VIEW_WIDTH = 24;
const VIEW_HEIGHT = 12;

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function projectEquirectangular(latitude: number, longitude: number): GpsPoint | null {
  if (!isValidCoordinate(latitude, longitude)) return null;

  return {
    x: ((longitude + 180) / 360) * WORLD_MAP_WIDTH,
    y: ((90 - latitude) / 180) * WORLD_MAP_HEIGHT,
  };
}

/**
 * Compute a zoomed SVG viewBox centered on the projected point, clamped to the
 * world map bounds [0, WORLD_MAP_WIDTH] × [0, WORLD_MAP_HEIGHT]. Near edges the
 * window shifts so it stays in-bounds, which means the point can go off-center
 * (that is expected and fine).
 */
export function computeViewBox(latitude: number, longitude: number): ViewBox | null {
  const point = projectEquirectangular(latitude, longitude);
  if (!point) return null;

  let minX = point.x - VIEW_WIDTH / 2;
  let minY = point.y - VIEW_HEIGHT / 2;

  // Clamp the window inside the world bounds; keep its size fixed by shifting
  // the opposite edge rather than shrinking the view.
  if (minX < 0) minX = 0;
  if (minX + VIEW_WIDTH > WORLD_MAP_WIDTH) minX = WORLD_MAP_WIDTH - VIEW_WIDTH;
  if (minY < 0) minY = 0;
  if (minY + VIEW_HEIGHT > WORLD_MAP_HEIGHT) minY = WORLD_MAP_HEIGHT - VIEW_HEIGHT;

  // Round to 4 decimals for stable, readable output.
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return {
    minX: round(minX),
    minY: round(minY),
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
  };
}

function viewBoxString(vb: ViewBox): string {
  return `${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`;
}

export function WorldLandDefinition() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: 'absolute', overflow: 'hidden' }}
    >
      <defs>
        <path id={WORLD_LAND_ID} d={WORLD_LAND_PATH} />
        <path id={COUNTRY_BORDERS_ID} d={WORLD_BORDER_PATH} />
      </defs>
    </svg>
  );
}

export function GpsMap({ latitude, longitude }: Props) {
  const point = projectEquirectangular(latitude, longitude);
  const viewBox = computeViewBox(latitude, longitude);

  if (!point || !viewBox) return null;

  // The marker was authored for a 360-wide viewBox. Scale radii and stroke
  // width by the zoom factor so the on-screen marker size is unchanged.
  const scale = viewBox.width / WORLD_MAP_WIDTH;
  const ringRadius = 5 * scale;
  const dotRadius = 2 * scale;
  const strokeWidth = 2 * scale;
  const markerInset = 6 * scale;
  const markerX = Math.min(
    Math.max(point.x, viewBox.minX + markerInset),
    viewBox.minX + viewBox.width - markerInset,
  );
  const markerY = Math.min(
    Math.max(point.y, viewBox.minY + markerInset),
    viewBox.minY + viewBox.height - markerInset,
  );

  const city = nearestCity(latitude, longitude);
  const locationLabel = formatLocation(city);
  const placeLabel = city?.parentName ? `${city.name} (${city.parentName})` : city?.name;
  const placeLabelOnRight = markerX > viewBox.minX + viewBox.width * 0.7;
  const placeLabelX = markerX + (placeLabelOnRight ? -0.75 : 0.75);
  const placeLabelY = markerY - 0.65;

  return (
    <figure className="gps-map">
      <svg
        className="gps-map__canvas"
        aria-hidden="true"
        focusable="false"
        viewBox={viewBoxString(viewBox)}
        width={WORLD_MAP_WIDTH}
        height={WORLD_MAP_HEIGHT}
        role="presentation"
      >
        <use className="gps-map__land" href={`#${WORLD_LAND_ID}`} />
        <use className="gps-map__borders" href={`#${COUNTRY_BORDERS_ID}`} />
        {locationLabel && placeLabel && (
          <text
            className="gps-map__place-label"
            x={placeLabelX}
            y={placeLabelY}
            textAnchor={placeLabelOnRight ? 'end' : 'start'}
          >
            {placeLabel}
          </text>
        )}
        <g className="gps-map__marker" transform={`translate(${markerX} ${markerY})`}>
          <circle className="gps-map__marker-ring" r={ringRadius} strokeWidth={strokeWidth} />
          <circle className="gps-map__marker-dot" r={dotRadius} />
        </g>
      </svg>
      {locationLabel && <p className="gps-map__location">{locationLabel}</p>}
      <figcaption className="gps-map__caption">{CAPTION}</figcaption>
    </figure>
  );
}
