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

The trailer renders **inside the backdrop panel**, morphing from the poster's
rect into the backdrop's own area. It must not become a modal or a separate
dialog: there is deliberately **no close button and no scrim**. Closing is
video-driven — the YouTube embed is loaded with `enablejsapi=1` and the panel
closes itself on `onStateChange` state 0 (ended). Escape remains the
keyboard-only escape hatch. Do not reintroduce a modal overlay or an on-screen
cancel affordance.

The hero's primary actions have two homes, and the swap is the point:

- **At rest** they are the labelled row at the bottom-left of the copy
  (`Watch Movie` / `Add to My List` / `Watch Trailer`).
- **While the trailer plays** that row hides (`invisible opacity-0`, so it keeps
  its space and nothing reflows) and the same actions reappear as icon-only
  circular buttons in the right rail, stacked directly under the poster in the
  top-right corner. They carry `aria-label`/`title` because the text is gone.

The right rail is `items-end` + `md:self-stretch`: the poster is pinned to the
top-right corner, and because the rail spans the hero's height the buttons sit
under the poster rather than drifting to the hero's vertical centre. The poster
stays visible the whole time — it is the anchor the icons hang from. When the
trailer ends the row fades back in exactly where it was.

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

## Player chrome gotchas

Three traps in `Player.tsx` / `PlayerEmbed.tsx` / `ProviderBar.tsx` cost real
time to find; do not reintroduce them.

- **Stacking contexts beat z-index.** `ProviderBar`'s dropdown is `z-30`, but
  the bar had `backdrop-blur-md`, which creates a stacking context; the player
  (`relative`, later in the DOM) then painted over the menu. A blurred
  ancestor traps every descendant's z-index. Keep the bar's surface plain
  translucent and give the *bar itself* the elevated level.
- **`disabled` swallows the gesture that enables a control.** The EQ band and
  pre-amp sliders were `disabled={!eq.enabled}` while their `onChange` set
  `enabled: true` — so the first drag could never fire. Use opacity styling,
  not `disabled`, when the interaction itself is meant to switch the control on.
- **Auto-hide must yield to open menus.** The 3 s `CONTROLS_TIMEOUT` and
  `onMouseLeave` both hid the chrome while a menu was open, so panels vanished
  mid-interaction. `menuRef` pins the controls while `menu !== 'none'`.

## Server failover

The watch page renders an `<iframe>` (`PlayerEmbed`) whose inner `Player` owns
one source. The inner player posts `frameXTV:error` only after it has tried
everything it holds; `PlayerEmbed` forwards it through `onFailure`, and
`WatchPage` owns the failover budget (`triedProviders`) so it can hop through
the provider bar and show the error overlay only once every provider has been
tried. Do not let the frame show its own error before the host has had a turn.

## Stream resolution

Upstream answers `/api/stream` from a pool of flaky providers: the *same*
request can return `sources: []` once and five sources a moment later. Two
rules follow, and both were bugs before:

- **Never cache an empty resolution.** `EmbedPage`'s query uses a functional
  `staleTime` (0 when `sources` is empty, 10 min when it is not). Caching the
  empty body for ten minutes is what made titles "hard to re-resolve" — a
  reload hit the poisoned cache instead of asking again. The query function
  also re-asks up to twice with a short backoff before giving up.
- **A no-source body is a dead end for this server, not for the title.** The
  embed posts `frameXTV:error` immediately on an empty resolution so the host
  hops providers right away instead of waiting out the frame watchdog.

Retries must be *new* requests. `WatchPage` keeps a `resolveNonce` that rides in
the embed URL as `&r=`, bumped on every failover hop and on the overlay's "Try
Again", so a retry cannot be served from the query cache. `PlayerEmbed` does not
treat the iframe's `load` event as readiness: a dead stream still fires `load`
for its error page, which previously masked every failure and suppressed
failover.
