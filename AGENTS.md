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

The rail's action cluster is a **vertical glassmorphism pill** — the two icons
stack in a column inside a frosted capsule (`rounded-full border-white/15
bg-white/10 backdrop-blur-md p-1.5`, `flex-col items-center gap-1.5`). Keep the
frost, the vertical order (play above star) and the icon-only default: the pill
is meant to read as a floating control, not a toolbar. The cluster is centred,
and the play button is the wider child, so the star sits mid-pill and the play
button's right edge lands flush with the poster's.

Once the viewer has played the trailer past twice, the play button **slides out
a `Watch Now` label** (`trailerPlays > 2`). It animates `max-width` + `margin`
from zero rather than to `auto`, so the slide has something to interpolate and
the collapsed state leaves no stray gap; the button sizes with `min-w-10 px-3`
so it can grow. The pulse is on the label text itself
(`.animate-watch-now-pulse`, opacity + scale) and not a box-shadow ring — the
label sits on the button's white fill, where a white ring would be invisible.
`prefers-reduced-motion` disables the pulse.

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

### Our own gateway (`src/lib/netweb.ts`)

The upstream CDNs 403 a bare browser request, so the player and the Download
button resolve through the **Net-web** gateway instead and keep the
aggregator's own sources as the fallback. An unreachable gateway degrades to
the old behaviour, not a black screen.

- The base URL is overridable (`?netweb=` query, then `localStorage`, then the
  default); `?netweb=local` opts out entirely, which is what the tests use.
- `EmbedPage` must **wait for the gateway before mounting `Player`**. Mounting
  as soon as the aggregator answered hands the player the fallback URL and
  silently undoes the preference; mounting with no `src` at all trips Player's
  "all servers exhausted" fallback and swaps in the backup iframe for a title
  the gateway was about to serve. The resolve is time-boxed (12 s) so a dead
  gateway costs a bounded pause rather than a hang.
- `Player`'s `downloadSource` is the **upstream** stream, not the `/proxy` URL
  the player loads: `/v1/download` fetches the segments itself to remux them.
  A plain anchor navigation saves the file — there is no wallet check, no
  holder perk and no client-side downloader in the path.
- The disabled Download row's reason comes from the gateway's own state, not
  `getDownloadInfo`, which only understands direct files and calls an HLS
  playlist "in private preview".

## Provider pre-resolution and Cloudflare

`warmStream` resolves a title **once per provider**, not once per title. Each
result is stashed in `sessionStorage` under
`framextv_warm_stream:<type>:<id>[:<s>:<e>]:<provider|auto>`, and `EmbedPage`
reads that key on its first attempt (a server hop or a retry always re-resolves,
via `&r=`). Warming fires in three places — detail page on mount, detail page on
trailer open, and the watch page on mount — so a cold link or refresh resolves
in the background while the embed boots. Each provider resolves inside its own
`try`, so one slow or refusing server cannot cancel the batch. Only the auto
resolution warms the segment cache; pre-resolving every provider's segments
would be a large amount of traffic for servers the viewer probably never picks.

The catalogue sits behind Cloudflare, which intermittently resets the
connection (`curl` reports `http=000`) or answers with a challenge instead of
JSON. `api.ts` therefore sends browser-shaped headers (`accept`,
`accept-language`) with `mode: 'cors'` and `credentials: 'omit'`, and retries a
thrown network error, a non-JSON body, or a 5xx up to three times with backoff.
Do not move these calls behind a server proxy: a plain client fetch is exactly
what avoids the challenge.
