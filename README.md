# Trail Archive

Your whole running history, on your device, searchable. One payment, no subscription.

## What is Trail Archive?

Trail Archive is a local-first, browser-only web app that imports your Strava bulk export and individual Garmin/watch files into a searchable archive stored entirely on your device using IndexedDB. No server, no account, no uploads—everything stays local.

## Features

- **Import**: Drag-and-drop Strava ZIP or individual .fit/.gpx/.tcx files (including .gz compressed)
- **Activity List**: Sortable, filterable table with saved filters
- **Heatmap**: All your routes on one map
- **Records**: Fastest 1mi, 5K, 10K, half, marathon, 50K, plus longest run and biggest climb
- **Gear Tracking**: Mileage per shoe with configurable retire threshold
- **Charts**: Year-over-year and date range comparison
- **Export**: Filtered CSV, GPX bundle, and AI-ready summary
- **Units Toggle**: Switch between miles and kilometers
- **PWA**: Installable, mobile-friendly
- **Privacy**: No network calls except app loading and map tiles

## Licensing

- **Free tier**: Activities from the most recent 12 months are fully accessible
- **Lifetime unlock**: Older activities require a one-time license key purchase
- License verification happens offline using Ed25519 signatures

## Getting Your Strava Export

1. Go to [Strava Account Download](https://www.strava.com/athlete/delete_your_account)
2. Click "Request Archive" (don't worry, you're not deleting your account)
3. Wait for the email with your download link (usually within an hour)
4. Download the ZIP and drag it into Trail Archive

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Opens at `http://localhost:5173`

### Build

```bash
npm run build
```

Outputs to `dist/`

### Tests

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

### Preview Production Build

```bash
npm run preview
```

## License Key Generation

### Generate Keys

```bash
node scripts/keygen.mjs
```

This outputs:
- Public key (SPKI hex) → Replace `PUBLIC_KEY_SPKI_HEX` in `src/license.ts`
- Private key (PKCS#8 hex) → Store securely, never commit

### Sign a License

```bash
PRIVATE_KEY_HEX=<your-private-key> node scripts/sign-license.mjs lifetime
```

Or for a timed license (365 days):

```bash
PRIVATE_KEY_HEX=<your-private-key> node scripts/sign-license.mjs 365
```

## Deployment

The app is configured for GitHub Pages with a custom domain `trailarchive.pittsdev.com`.

### GitHub Pages Setup

1. Push to `main` branch
2. GitHub Actions automatically builds and deploys
3. Configure custom domain in repository settings

### Custom Domain

The `public/CNAME` file contains `trailarchive.pittsdev.com`. Update this to your domain.

## Architecture

- **Frontend**: Vite + TypeScript
- **Storage**: IndexedDB via `idb`
- **Parsing**: Web Worker with `fflate` for streaming unzip, `fit-file-parser` for FIT files
- **Maps**: Leaflet + OpenStreetMap tiles
- **PWA**: vite-plugin-pwa with Workbox

## Project Structure

```
.
├── public/              # Static assets (CNAME, icons, favicon)
├── scripts/             # License key generation and signing
├── src/
│   ├── parsers/         # CSV, GPX, TCX, FIT parsers
│   ├── __tests__/       # Unit tests
│   ├── db.ts            # IndexedDB operations
│   ├── license.ts       # License verification
│   ├── main.ts          # Application entry point
│   ├── records.ts       # PRs/best efforts computation
│   ├── styles.css       # Global styles
│   ├── types.ts         # TypeScript types
│   ├── utils.ts         # Formatting and utilities
│   └── worker.ts        # Web Worker for import
├── index.html           # HTML entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Known Limitations (v1)

- GPX export is stubbed
- Elevation profile visualization not yet implemented
- Compare-two-date-ranges chart view is stubbed
- Best efforts use estimated times from full activities; GPS-based sliding window is implemented but may need tuning

## License

MIT
