import type { MetadataSummary } from '../lib/preview';

interface Props {
  title: string;
  meta: MetadataSummary | null;
  variant: 'before' | 'after';
}

export function MetadataPanel({ title, meta, variant }: Props) {
  if (!meta) {
    return (
      <div className={`meta meta--${variant}`}>
        <h4>{title}</h4>
        <p className="meta__loading">reading…</p>
      </div>
    );
  }

  if (meta.clean) {
    return (
      <div className={`meta meta--${variant}`}>
        <h4>{title}</h4>
        <p className="meta__clean">No metadata found</p>
      </div>
    );
  }

  return (
    <div className={`meta meta--${variant}`}>
      <h4>
        {title} <span className="meta__count">{meta.fieldCount} fields</span>
      </h4>
      {meta.gps && (
        <p className="meta__gps">
          GPS {meta.gps.latitude.toFixed(5)}, {meta.gps.longitude.toFixed(5)}
        </p>
      )}
      <dl>
        {Object.entries(meta.fields).map(([key, value]) => (
          <div key={key} className="meta__row">
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
