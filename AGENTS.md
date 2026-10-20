# AGENTS.md

Persistent notes for this repository. Keep entries short and factual.

## What this is

A React + Vite + Tailwind v4 SPA that reproduces framextv.xyz — the goal is a
verbatim port of that site's styling *and* behaviour. The reference is a
compiled Vite SPA with a fixed dark scheme; anything we add (a light scheme,
the companion app) must not change how the dark site looks or behaves.

## Commands

- `npm run build` — `tsc -b && vite build`. Must stay clean.
- `npm run dev` / `npx vite preview --port 4173` — local servers used for
  browser verification.

## Theme rules

- The theme is **device-driven and has no toggle**. `prefers-color-scheme` is
  the only source of truth; never add a toggle or a `localStorage` override
  (a stored choice would outlive the OS setting and strand the visitor).
- `index.html` sets `data-theme` in an inline script before first paint so
  there is no wrong-theme flash. `useTheme()` in `src/lib/theme.ts` takes over
  and follows live OS flips.
- Dark is the reference's own scheme — leave it alone.
- Light is an accent-blue gradient over white with glassmorphism surfaces.
  Design tokens live in `src/index.css`: `.glass-panel`, `.glass-control`,
  `.glass-frame`, `.accent-active`, `.page-bg`.
- `.page-bg` is unlayered so it beats the `bg-black` utility on the element.
  Media surfaces (the player, poster chips) stay black in both themes.

## Trailer

The trailer renders **inline**, morphing into the poster slot; closing it
restores the poster. Do not reintroduce a modal/overlay.

## Install banner

The banner keeps the reference's chrome but points at the Netflix-pro mobile
app, downloading the APK straight from GitHub releases
(`APP_DOWNLOAD_URL` in `src/lib/brand.ts`). Never route the download through
another host.

## Person profiles

frameXTV.xyz has **no** person page and its backend has **no** person endpoint:
every `/api/person*` path falls through to the root banner, and
`/api/details?type=person` ignores the type. So there is nothing to port — the
profile page at `/person/:tmdbId` is an addition. It is assembled from keyless,
CORS-permissive sources in `src/lib/people.ts`:

- **Wikidata** — identity and filmography. A cast member's TMDB person id
  (`P4985`) resolves to the entity; credited works (`P161`) carry TMDB ids
  (`P4947`), so filmography rows link into our own detail pages.
- **Wikipedia REST** — the biography prose.
- **TVMaze** — a portrait fallback when Commons has no image.

TMDB itself is not usable: the only reachable key is the one behind
`api.framextv.tech/api/proxy`, and it is dead (`Invalid API key`). Do not
reintroduce a TMDB dependency without a working key.

Sorting goes through `SortSelect`, shared with `DiscoveryFilterBar`, so the
filmography and the browse grids cannot drift apart.

## Verification

Browser checks live in `/tmp/verify.cjs` and `/tmp/verify2.cjs` (Playwright +
chromium). They cover the theme suite and the live device-flip suite, and must
both pass before committing.
