# EndExif

Strip EXIF, GPS and other metadata from your photos — **100% in your browser**.
Your files never leave your device. No uploads, no servers, no analytics.

## Features

- **Lossless stripping** — metadata segments are removed at the byte level.
  Image pixels are bit-identical to the original. No re-encoding, no quality loss.
- **Before/after proof** — the app shows you the metadata it found (GPS
  coordinates, camera, timestamps), then re-reads the cleaned file to prove
  nothing is left.
- **Formats** — JPEG, PNG, WebP, GIF, TIFF, HEIC, SVG, DNG/RAW.
- **Batch** — strip many photos at once, download individually or as one ZIP.
- **Offline** — installable PWA, works fully offline after first load.
- **Options** — keep rotation and/or color profile if you want them.

## Why you can trust it

Privacy claims are cheap. This app is built so you can **verify** them:

1. **The browser blocks the network.** The deployed page enforces
   `Content-Security-Policy: connect-src 'none'`. Every fetch, XHR, WebSocket
   or beacon from the page is blocked by the browser engine itself — not by
   our promise.
2. **Check the Network tab.** Open DevTools → Network, strip a photo, watch
   nothing happen. There is nothing to hide.
3. **Go offline.** Load the page once, pull the network cable / enable airplane
   mode, keep using it. Everything works.
4. **Read the code.** The whole app is a small, dependency-light static site.
   The stripping happens in [`src/worker/strip.worker.ts`](src/worker/strip.worker.ts)
   via the zero-dependency [picscrub](https://github.com/fasouto/picscrub)
   library.
5. **Reproducible builds.** Every CI build publishes SHA-256 checksums of the
   deployed files. Clone the repo, `npm ci && npm run build`, and compare
   `dist/` hashes yourself.

## How it works

- Files are read with the File API and handed to a **Web Worker** as
  transferable buffers (zero-copy).
- The worker parses the image's binary structure (JPEG APP segments, PNG
  chunks, WebP RIFF chunks, …) and removes metadata-carrying segments:
  EXIF, XMP, IPTC, GPS, comments, thumbnails.
- HEIC files are processed locally as well — nothing is sent anywhere, ever.
- Batch downloads are assembled with [fflate](https://github.com/101arrowz/fflate)
  and saved via the File System Access API where available (Blob download
  fallback elsewhere).

## Develop

```sh
npm install
npm run dev        # dev server (note: CSP meta is only injected in prod builds)
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build locally
```

## Self-host

It's a static site. Build it and put `dist/` on any static host:

```sh
npm ci && npm run build
```

GitHub Pages deploys automatically from `main` via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Fork the repo,
enable Pages (source: GitHub Actions), done.

## License

[MIT](LICENSE)
