# Howlin' At The Moon Fest – Astro Site

One-page Astro experience highlighting the Howlin' At The Moon Fest with sections for hero storytelling, featured events, nightly schedule, media gallery, sponsors, FAQs, and ticketing prompts. The layout is powered by Tailwind CSS and now consumes the live WeBeFriends integration API with graceful fallbacks when credentials are missing or content bundles are disabled.

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
```

The build command outputs a static site to `dist/`. Use `npm run preview` to validate the build locally before deployment.

## Environment Variables

Create a `.env` file (or export variables in your shell) before running or building:

```sh
WEBE_API_KEY="<one-time key issued in Integration Studio>"
# Optional overrides
# WEBE_SITE_SLUG="howlin-yuma"
# WEBE_API_BASE="https://webefriends.com/api/integrations"
```

`WEBE_API_KEY` is required for production data. If it is missing, the build falls back to local mock content so you can continue developing UI without external connectivity.

## Data Notes

- `fetchFestivalContent()` fetches `https://webefriends.com/api/integrations/{siteSlug}` server-side, respects `Cache-Control` headers (120s max-age, 300s stale-while-revalidate), and caches results in-memory during the process lifetime.
- Every payload section (hero, stats, events, schedule, gallery, sponsors, FAQs) is optional. The UI hides sections automatically when a bundle is disabled.
- If the remote request fails or the key is invalid/rotated, the client serves the last cached response; if none exists it falls back to a local mock festival dataset.
- Image assets stream directly from WeBeFriends. Swap any bespoke placeholders in `public/images/` once final art is available.

## Next Steps

1. Replace the placeholder ticket CTA links with the real commerce endpoints once they are provisioned.
2. Add integration-health telemetry (e.g., surfacing stale cache warnings in the admin UI) if desired.
3. Wire optional bundles like feed posts when the WeBeFriends API exposes them.
