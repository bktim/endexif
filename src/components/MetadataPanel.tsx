import type { MetadataSummary } from '../lib/preview';

interface Props {
  title: string;
  meta: MetadataSummary | null;
  variant: 'before' | 'after';
}

interface ValueDisclosureProps {
  label: 'sample' | 'expanded value';
  value: string;
}

function ValueDisclosure({ label, value }: ValueDisclosureProps) {
  return (
    <details className="meta__disclosure">
      <summary className="meta__disclosure-summary">
        <span className="meta__action meta__action--closed">View {label}</span>
        <span className="meta__action meta__action--open">Hide {label}</span>
      </summary>
      <div className="meta__full-value">{value}</div>
    </details>
  );
}

function MetadataValue({ value, sample }: { value: string; sample?: string }) {
  if (sample !== undefined) {
    return (
      <>
        {value}
        <ValueDisclosure label="sample" value={sample} />
      </>
    );
  }

  if (value.length > 160 && (value.startsWith('{') || value.startsWith('['))) {
    return (
      <>
        {value.slice(0, 79)}…
        <ValueDisclosure label="expanded value" value={value} />
      </>
    );
  }

  return value;
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
        {Object.entries(meta.fields).map(([key, value]) => {
          const sample =
            meta.fieldSamples && Object.hasOwn(meta.fieldSamples, key)
              ? meta.fieldSamples[key]
              : undefined;

          return (
            <div key={key} className="meta__row">
              <dt>{key}</dt>
              <dd>
                <MetadataValue value={value} sample={sample} />
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
