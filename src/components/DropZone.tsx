import { useCallback, useRef, useState } from 'react';

interface Props {
  onFiles: (files: File[]) => void;
}

export function DropZone({ onFiles }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setOver(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  return (
    <div
      className={`dropzone${over ? ' dropzone--over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif,.tif,.tiff,.dng,.svg"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
      <p className="dropzone__title">Drop photos here</p>
      <p className="dropzone__sub">
        or click to browse — JPEG, PNG, WebP, GIF, TIFF, HEIC, SVG, RAW
      </p>
      <p className="dropzone__privacy">Files never leave this device</p>
    </div>
  );
}
