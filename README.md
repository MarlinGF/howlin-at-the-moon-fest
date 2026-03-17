# Howlin' At The Moon Fest – Astro Site

One-page Astro experience highlighting the Howlin' At The Moon Fest with sections for hero storytelling, featured events, nightly schedule, media gallery, sponsors, FAQs, and ticketing prompts. The layout is powered by Tailwind CSS and now consumes the live WeBeFriends integration API with graceful fallbacks when credentials are missing or content bundles are disabled. Event data is streamed at runtime from Firebase via `/api/events`, so deployments pick up schedule changes without rebuilding the static site.

## Project Stack

- Astro 5 with the static adapter
- Tailwind CSS 4 via `@tailwindcss/vite`
- WeBeFriends integration client (`src/lib/webeFriendsClient.ts`) with cache-aware fetch logic

## Local Development

```sh
npm install
npm run dev
```

The development server binds to `0.0.0.0` so it can be previewed across devices on the same network. Stop it at any time with `Ctrl+C`.

## Production Build

```sh
npm run build
npm run preview
# Compile serverless functions when deploying
npm --prefix functions run build
```

The build command outputs a static site to `dist/`. Use `npm run preview` to validate the build locally before deployment.

## Environment Variables

Copy [`.env.example`](/Users/marlinandrews/Documents/Howlin-Build/.env.example) to `.env.local` before running or building:

```sh
WEBE_API_BASE_URL="https://webefriends.com"
WEBE_PAGE_ID="<WeBe page UID>"
WEBE_SITE_SLUG="howlin-yuma"
WEBE_API_KEY="<one-time key issued in Integration Studio>"
WEBE_CHECKOUT_SUCCESS_URL="https://your-domain.example/checkout/success"
WEBE_CHECKOUT_CANCEL_URL="https://your-domain.example/checkout/cancel"
# Optional when webhook/cache invalidation is enabled
# WEBE_WEBHOOK_URL="https://your-domain.example/api/webe/webhook"
# WEBE_WEBHOOK_SECRET="<shared secret configured in Integration Studio>"
# Temporary legacy fallback supported during migration only:
# WEBE_API_BASE="https://webefriends.com/api/integrations"
# PUBLIC_SITE_URL="https://your-prod-domain.example"
# PUBLIC_GA_MEASUREMENT_ID="G-XXXXXXXXXX"
# FIREBASE_SERVICE_ACCOUNT='{"projectId":"howling-vs-build",...}'
```

This repo now follows the canonical connected-site naming for WeBe secrets: `WEBE_API_BASE_URL`, `WEBE_PAGE_ID`, `WEBE_SITE_SLUG`, `WEBE_API_KEY`, checkout URLs, and optional webhook/service-fee variables. `WEBE_API_BASE` is still read as a temporary compatibility shim, but new setups should use `WEBE_API_BASE_URL` only.

`WEBE_API_KEY` is required for production data. If it is missing, the build falls back to local mock content so you can continue developing UI without external connectivity.

Store `WEBE_WEBHOOK_SECRET` as a Firebase Functions secret so webhook signatures can be validated in production:

```sh
firebase functions:secrets:set WEBE_WEBHOOK_SECRET
```

During local development you can still keep a copy inside `.env.local`, but deployments read the managed secret automatically.

`PUBLIC_SITE_URL` is used to generate absolute Open Graph and Twitter image URLs so social platforms pick up the default share graphic in `public/images/moon-bkg.png`.

Set `PUBLIC_GA_MEASUREMENT_ID` to enable Google Analytics 4 tracking across every deployment.

`FIREBASE_SERVICE_ACCOUNT` is optional for local development; when running on Firebase Hosting the default credentials from the `howling-vs-build` project are used automatically.

The shared visitor counter lives at `src/pages/api/visitor-count.ts`. It uses Firestore to log one hit per visitor each day (deduplicated across all domains) and `src/scripts/pageViewCounter.js` renders the value in the footer. Firebase Hosting rewrites `/api/visitor-count` to the Cloud Function in `functions/src/index.ts` for production, while the Astro route stays usable during local development.

## Runtime Events Endpoint

- `functions/src/eventsApi.ts` exposes an `eventsApi` HTTPS function that reads the latest WeBe snapshot from `webeSites/{siteSlug}`, filters to published, upcoming events (allowing a 24-hour grace window), and returns JSON.
- Firebase Hosting rewrites `/api/events` to that function so the static site can fetch live data without enabling full SSR.
- `src/scripts/runtimeEvents.client.js` runs on every page load, fetches `/api/events`, and renders the highlights grid, schedule carousel, and modal dialogs dynamically. When the feed is empty it displays graceful placeholder messaging.
- The visitor never needs a rebuild to see updates—webhooks refresh Firestore, and the runtime fetch picks up the changes immediately.

## Data Notes

- WeBe requests are server-side only and now send both required auth headers: `Authorization: Bearer <api-key>` and `X-API-Key: <api-key>`.
- `fetchFestivalContent()` still hydrates hero, stats, gallery, sponsors, and FAQ copy during the Astro build, but events themselves now render exclusively through the runtime endpoint.
- Every payload section (hero, stats, events, schedule, gallery, sponsors, FAQs) is optional. The UI hides sections automatically when a bundle is disabled.
- Future WeBe block mappings live in one place: `src/lib/connectedModules.ts` (`moduleTypeAliasMap` and the `switch (block.type)` branch in `extractConnectedModules`).
- If the remote request fails or the key is invalid/rotated, the build falls back to the last cached response; if none exists it falls back to a local mock festival dataset.
- Image assets stream directly from WeBeFriends. Swap any bespoke placeholders in `public/images/` once final art is available.
- Incoming `events.changed` webhooks land on the `webeEvents` Cloud Function, which validates the managed `WEBE_WEBHOOK_SECRET`, de-duplicates retries, and updates the Firestore cache so deletions disappear instantly and updates reorder chronologically.
- The current integration snapshot lives in Firestore under `webeSites/{siteSlug}`; `fetchFestivalContent()` first reads this cache so the static site reflects webhook changes without waiting for a rebuild.
- A scheduled `webeNightlyRefresh` function re-syncs the full bundle from the WeBeFriends API every night to recover from any missed webhooks.

## Validation

Run the connected-site validation check before handoff:

```sh
npm run validate:webe
```

That command loads `.env.local`, performs the authenticated content fetch against `GET /api/integrations/<site-slug>`, and prints the key payload metadata. You can optionally dry-run checkout creation by setting:

```sh
WEBE_VALIDATE_MERCH_CHECKOUT=true
WEBE_TEST_PRODUCT_ID="<real merch product id>"
WEBE_VALIDATE_MUSIC_CHECKOUT=true
WEBE_TEST_SONG_ID="<real song id>"
```

The validator uses the canonical merch lane (`/checkout`) and music lane (`/music/checkout`) separately, matching the connected-site standard.

## Next Steps

1. Replace the placeholder ticket CTA links with the real commerce endpoints once they are provisioned.
2. Add integration-health telemetry (e.g., surfacing stale cache warnings in the admin UI) if desired.
3. Wire optional bundles like feed posts when the WeBeFriends API exposes them.
