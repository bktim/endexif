import { type SyntheticEvent, useState } from 'react';
import type { FileItem } from '../types';
import { GpsMap } from './GpsMap';
import { MetadataPanel } from './MetadataPanel';

interface Props {
  item: FileItem;
  onDownload: (item: FileItem) => void;
  onRemove: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function FileCard({ item, onDownload, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const { status, result } = item;

  return (
    <article className={`card card--${status}`}>
      <div className="card__head">
        {item.previewUrl ? (
          <img className="card__thumb" src={item.previewUrl} alt="" loading="lazy" />
        ) : (
          <div className="card__thumb card__thumb--placeholder" aria-hidden>
            {item.file.name.split('.').pop()?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="card__info">
          <p className="card__name" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="card__meta">
            {formatBytes(item.file.size)}
            {result && (
              <>
                {' → '}
                {formatBytes(result.cleanedSize)}
                <span className="card__saved">
                  {' '}
                  (−{formatBytes(result.originalSize - result.cleanedSize)})
                </span>
              </>
            )}
          </p>
        </div>
        <div className="card__actions">
          {status === 'stripping' && <span className="badge badge--busy">stripping…</span>}
          {status === 'done' && (
            <>
              <span className="badge badge--ok">clean</span>
              <button type="button" className="btn btn--small" onClick={() => onDownload(item)}>
                Download
              </button>
            </>
          )}
          {status === 'error' && <span className="badge badge--err">failed</span>}
          <button
            type="button"
            className="btn btn--ghost"
            aria-label={`Remove ${item.file.name}`}
            onClick={() => onRemove(item.id)}
          >
            ×
          </button>
        </div>
      </div>

      {status === 'error' && item.error && <p className="card__error">{item.error}</p>}

      {status === 'done' && result && (
        <div className="card__result">
          {result.removedMetadata.length > 0 ? (
            <p className="card__removed">
              Removed: {result.removedMetadata.join(', ')}
            </p>
          ) : (
            <p className="card__removed">No metadata was present</p>
          )}
          {item.after?.clean && (
            <p className="card__verified">Verified clean — re-read of cleaned file found nothing</p>
          )}
          <button type="button" className="btn btn--link" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide details' : 'Show before / after'}
          </button>
          {expanded && (
            <div className="card__compare">
              <MetadataPanel title="Before" meta={item.before} variant="before" />
              <MetadataPanel title="After" meta={item.after ?? null} variant="after" />
            </div>
          )}
        </div>
      )}

      {status === 'ready' && item.before?.clean && (
        <div className="card__result">
          <p className="card__verified">Already clean — no metadata found in this file</p>
        </div>
      )}

      {status === 'ready' && item.before && !item.before.clean && (
        <div className="card__result">
          {item.before.gps && (
            <>
              <p className="card__warning">
                Contains GPS location: {item.before.gps.latitude.toFixed(5)},{' '}
                {item.before.gps.longitude.toFixed(5)}
              </p>
              <GpsMap
                latitude={item.before.gps.latitude}
                longitude={item.before.gps.longitude}
              />
            </>
          )}
          <p className="card__removed">
            {item.before.fieldCount} metadata fields — {item.before.camera ?? 'unknown camera'}
            {item.before.takenAt ? ` — ${item.before.takenAt}` : ''}
          </p>
          <details
            className="card__metadata"
            onToggle={(event: SyntheticEvent<HTMLDetailsElement>) =>
              setMetadataOpen(event.currentTarget.open)
            }
          >
            <summary className="card__metadata-summary">
              View all {item.before.fieldCount} metadata fields
            </summary>
            {metadataOpen && <MetadataPanel title="Metadata" meta={item.before} variant="before" />}
          </details>
        </div>
      )}
    </article>
  );
}
