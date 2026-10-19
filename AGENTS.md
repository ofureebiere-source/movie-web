# AGENTS.md — movie-web (King-Fisher000/movie-web)

## Repo identity

- Remote: `King-Fisher000/movie-web`. Default branch `main`. Deploy target for Vercel.
- Fork of upstream `ptduy14/movie-web` (MIT). The full history is retained
  deliberately: the MIT license and copyright attribution live in it, and
  stripping it would breach the license. Do not shallow-clone this repo.
- Stack: Next.js 14.2.5 (App Router), React 18, TypeScript 5, Tailwind 3,
  next-intl, Firebase. Node 24.x (`engines.node`).
- **The UI must stay brand-free.** The upstream project name must not appear in
  any served page. Verify with a grep of the served HTML, not the source tree
  (`package.json` `name` and `package-lock.json` still carry it and are not
  served; that is acceptable).
- **Brand text hides in images.** The header wordmark used to be
  `public/logo.png`, a bitmap that spelled the old name — invisible to a text
  grep of the HTML, and it shipped for several sessions because of that. It has
  been deleted and replaced by the text wordmark in
  `components/commons/wordmark.tsx`. Do not reintroduce a logo image. When
  auditing brand, rasterise every asset in `public/` and read it, not just grep.
  `public/mini-logo.png` (an "M" monogram) and `app/favicon.ico` are deliberately
  kept and carry no name.

## Branch / commit conventions

- **`main` only.** Commit and push directly to `main`. No feature branches, no
  pull requests.
- Use `$GITHUB_PUSH_TOKEN` (account `King-Fisher000`) for pushes. `$GITHUB_TOKEN`
  is a different account and 404s on this repo.
- Keep the remote URL credential-free; inject the token only for the push.

## Vercel deployment (live, verified 2026-10-18)

| | |
| --- | --- |
| Project | `netflix-2.0` (display name "Netflix 2.0") |
| Project ID | `prj_99SFct8dyhDS2RICa3wOesP4k4ij` |
| Team | `edges2` — `team_eGwDTAuMrjsrrzleqoLCtd7N` |
| Canonical URL | <https://netflix2point0.vercel.app> |
| Framework preset | Next.js |
| Build / install | `npm run build` / `npm ci` |
| Node | 24.x |
| Git link | `King-Fisher000/movie-web`, repoId 1424305619, productionBranch `main` |

Push to `main` triggers a production deploy (git-triggered deployments are
enabled on the project). To deploy from the API instead:

```bash
curl -s -X POST -H "Authorization: Bearer $Vercel" -H "Content-Type: application/json" \
  -d '{"name":"netflix-2.0","project":"prj_99SFct8dyhDS2RICa3wOesP4k4ij","target":"production","gitSource":{"type":"github","repoId":1424305619,"ref":"main"}}' \
  "https://api.vercel.com/v13/deployments?teamId=team_eGwDTAuMrjsrrzleqoLCtd7N"
```

### Domain naming traps

- A Vercel project name is a DNS slug: lowercase only, no spaces. `Netflix 2.0`
  is not a legal name; `netflix-2.0` is. The owner calls the site **Netflix 2.0**,
  so that is the display name to use in prose.
- The team cannot add `*.0.vercel.app` domains ("does not have access to
  `*.0.vercel.app`"). That is why the canonical domain is `netflix2point0`
  rather than `netflix-2.0.vercel.app`.
- **Renaming a project does not move its default domain or its deployment
  aliases.** After renaming from `movie-web` to `netflix-2.0`, the old
  `movie-web-six-ashy.vercel.app` domain and the `movie-web-edges2` /
  `movie-web-git-main-edges2` aliases persisted and served the branded name.
  They must be deleted explicitly (`DELETE /v9/projects/{id}/domains/{domain}`
  and `DELETE /v2/aliases/{uid}`); a fresh deployment then regenerates
  brand-free aliases from the new name.

### `gitProviderOptions.createDeployments`

Project creation may set `createDeployments: "disabled"`, which silently stops
push-triggered builds. Enable it before relying on push-to-deploy:

```bash
curl -s -X PATCH -H "Authorization: Bearer $Vercel" -H "Content-Type: application/json" \
  -d '{"gitProviderOptions":{"createDeployments":"enabled","disableRepositoryDispatchEvents":false}}' \
  "https://api.vercel.com/v9/projects/prj_99SFct8dyhDS2RICa3wOesP4k4ij?teamId=team_eGwDTAuMrjsrrzleqoLCtd7N"
```

## Environment variables

Set on the Vercel project for production, preview and development.

| Key | Notes |
| --- | --- |
| `FIREBASE_CREDENTIALS_BASE64` | **Hard build blocker.** `lib/firebase-admin.ts` throws at build time if unset or not structurally valid service-account JSON. Currently a **throwaway placeholder** RSA service account (project `placeholder-project`) so the build succeeds. |
| `NEXT_PUBLIC_FIREBASE_*` (6) | Currently **placeholders**. Auth, collections, comments and watch-progress need real values. |
| `NEXT_PUBLIC_TMDB_ACCESS_TOKEN` | Currently a **placeholder**; without a real v4 token TMDB extras/hero-trending are unavailable (the hero falls back to the newest catalogue titles, so the site still renders). |
| `NEXT_PUBLIC_TMDB_IMG_DOMAIN` | `https://image.tmdb.org` |
| `CATALOG_API_BASE` | `https://phimapi.com` (see below). |
| `NEXT_PUBLIC_VIDSRC_DOMAIN` | `https://vidsrc.sh` |
| `NEXT_PUBLIC_VIDSRC_SANDBOX` | `false` — leave false until verified against the provider's anti-sandbox check; see `docs/vidsrc-migration-plan.md`. |
| `CRON_SECRET` | Random string; `app/api/translate/cron-batch/route.ts` requires `Authorization: Bearer $CRON_SECRET` (401 without it, 500 if unset). |
| `MAINTENANCE_MODE` | `false`. |

### `CATALOG_API_BASE` is NOT the Net-web API

The catalogue client (`services/catalog-api.ts`) speaks the **phimapi** shape:
`/danh-sach/phim-moi-cap-nhat-v3`, `/v1/api/danh-sach/*`, `/phim/{slug}`,
`/v1/api/tim-kiem`. Net-web (`netweb.server`) serves a **different, Stremio-addon
shaped** API (`/v1/catalog`, `/v1/stream?tmdb=`, `/v1/sources`) and has no
`/danh-sach/*` or `/v1/api/*` routes, so pointing `CATALOG_API_BASE` at
`https://netweb-apsv.onrender.com` breaks the entire catalogue (every list and
detail 404s). The two properties are **not** drop-in compatible; connecting them
needs an adapter layer, which does not exist yet. Leave it at `phimapi.com`.

## Local build

The app is **keyless**: no Firebase, no TMDB token, no service account. A
checkout with an empty environment builds and runs (`npm ci && npm run build`).
Titles come from the framextv catalogue, accounts are per-browser device
identities, and comments/watch progress stay in the browser.

## Device identity and notifications

There is no sign-up and no sign-in. `lib/device.ts` mints a random id on first
load and keeps it in `localStorage`; that id is the account, and collections,
comments and watch history are keyed by it. `components/context/auth-conext.tsx`
publishes it to Redux so the existing screens read `state.auth.user` unchanged.

**The device identity is never shown to the viewer.** It used to be: the account
menu printed the id and a device name, the profile page had a "device" section
with rename and forget buttons. That read as something the viewer had signed up
for when they had not, so it was removed. The registration still happens — it is
what gives the recommendation engine and notifications a stable subject. Do not
surface it again.

Notifications are the one thing the viewer *does* control, so they get a screen
instead: `components/profile/notification-settings.tsx`, and a one-time bar
(`components/notification/notification-prompt.tsx`) shown only while the browser
permission is still undecided. `lib/push.ts` asks for permission and mints a
per-device token paired with the device id. There is no push service credential
yet — the token is the seam where one goes.

## Routes

`app/[locale]/…` with `localePrefix: 'always'`; 14 locales, `vi` default. `/`
redirects to a locale via `middleware.ts` `pickLocaleFromGeo` (country → locale,
unlisted countries → `en`), so a non-VN client sees `/` → `/en`. There is no
`/movies` index page (404 by design); the taxonomy roots are
`/movies/format/{slug}`, `/movies/type/{slug}`, `/movies/country/{slug}`, plus
`/movies/collection`, `/movies/recent`, `/movies/{slug}` and
`/movies/watch/{slug}`. `app/maintenance/[locale]` renders outside the locale
segment. Locales in `RTL_LOCALES` (`ar`, `he`, `fa`, `ur`) render `dir="rtl"`.

## Catalogue

`services/framextv-api.ts` talks to the framextv backend. Reads happen **in the
browser first**, because the provider's site origin blocks datacenter IPs and the
Vercel Node runtime is one, then fall through to `app/api/catalog/[...path]`,
an **Edge-runtime** passthrough. Two independent reasons the fallback is not
optional:

- Cloudflare answers the Node serverless pool with a 403 challenge on every
  host and every endpoint (verified), but does **not** challenge the Edge IP
  pool. Edge is the only server-side path that works in production.
- `/anime/api/*` sends no `access-control-allow-origin` at all, so the browser
  can never read it directly, whatever origin it is on. Anime only ever loads
  through the proxy.

The proxy allows only `/api/` and `/anime/api/` prefixes so it cannot be aimed
at arbitrary hosts. `hooks/useResolvedStream.ts` uses the same direct-then-proxy
order for playback, since the anime stream endpoint has the same CORS gap.

`NEXT_PUBLIC_CATALOG_API_BASE` (falling back to `CATALOG_API_BASE`) sets the
base and must carry the `NEXT_PUBLIC_` prefix or Next will not inline it into
the client bundle. `components/commons/prefetch-link.tsx` warms a browse page on
hover/focus so it paints with rows instead of a skeleton.

`/` redirects to a locale via `middleware.ts` `pickLocaleFromGeo`, so a
datacenter client (a US CI runner, a curl from Vercel) sees `/` → `/en` even
with `Accept-Language: vi`; the geo header wins. That is expected, not a bug.

## Brand

The product name is **Netflix-pro**, defined once in `constants/brand.ts`
(`SITE_NAME`, `WORDMARK_LEAD`, `WORDMARK_ACCENT`) and mirrored in each locale's
`footer.copyright` / `footer.disclaimer`. The owner asked for the name back
after an earlier brand-free pass; do not re-scrub it.

## Buttons

Every interactive surface wears the `glass-btn` classes from `app/globals.css`
(a translucent frosted pane with `backdrop-filter`). Do not give a button a
solid `bg-white` / `bg-red-600` / `bg-gray-*` fill — the owner asked for
glass-morphism throughout and solid colours to be removed. Variants:
`glass-btn-primary` (the one tinted action per surface), `glass-btn-active`
(selected chip), `glass-btn-sm`, `glass-btn-icon`, `glass-btn-block`.


## Images

`next.config.mjs` uses a **custom** loader (`image-loader.ts`) that routes every
image through `app/api/image` (self-hosted `sharp`), deliberately not Vercel's
metered Image Optimization API. `app/api/image/route.ts` re-validates host and
width independently and allows only the hosts in its `ALLOWED_HOSTS` set
(TMDB, `phimimg.com`, Google avatars, `media.kitsu.app` plus Kitsu's Backblaze
bucket, AniList, Crunchyroll, and `upload.wikimedia.org` /
`commons.wikimedia.org` for person portraits). If images 404, suspect that
allow-list or `sharp`. Portrait URLs arrive as
`commons.wikimedia.org/wiki/Special:FilePath/<file>?width=400`, which redirects
to `upload.wikimedia.org`; both hosts must stay allowed.

## People (cast pages)

`/person/{tmdbId}` is an in-site person page: portrait, biography, birth/death
dates, occupations and a clickable filmography. It is fed entirely by **keyless**
sources in `services/person-service.ts` — no TMDB credential is involved:

- **Wikidata SPARQL** (`query.wikidata.org`) maps a TMDB person id to a Q-id via
  **P4985**, then reads P18 (portrait), P569/P570 (dates), P106 (occupations)
  and a description. Filmography is **P161** (cast member).
- **Wikipedia REST** (`/api/rest_v1/page/summary/...`) supplies the biography
  extract, via the `enwiki` sitelink.

Two non-obvious rules, both load-bearing:

- The filmography query **requires** a TMDB id (`P4947` movie / `P4983` TV,
  read with `UNION`, not two `OPTIONAL`s). Without that requirement Wikidata
  returns talk-show spots, commercials and crew credits — "Ruth's Chris
  Employees", "Halloween Candy (ft. Edward Norton)" — which are noise and
  unplayable anyway. Requiring the id also lets every credit link to a real
  `/movies/{slug}` page, so there are no dead-end rows.
- `CACHE_VERSION` in `person-service.ts` must be bumped whenever `PersonDetail`
  changes shape. Results are cached in `sessionStorage` for 24h, so without a
  bump a deploy that changes the shape leaves returning visitors on their own
  stale copy. This bit us once: a clean filmography still rendered the old
  noisy one until the version changed.

Cast cards on a title page (`components/actor/actor-item.tsx`) link **in-site**
to `/person/{id}?name=...`. They used to open the upstream site in a new tab.
The `?name=` param is only a fallback label while the fetch resolves.

`app/api/image/route.ts` and `next.config.mjs` must both allow the Wikimedia
hosts, or portraits 404.

## Provider filter support (probed 2026-10-18 — do not assume symmetry)

The film/series endpoints and the anime endpoints are **different upstreams**
with different parameter names. Assuming they match produces controls that look
applied and silently do nothing, which is worse than a missing control.

| | film/series (`/api/discover`) | anime (`/anime/api/discover`) |
|---|---|---|
| genre | numeric TMDB id | **genre NAME** (`Action`) |
| year | `year` | **`seasonYear`** — plain `year` is accepted and IGNORED |
| sort | ignored | ignored |
| country | ignored | ignored |

Verified specifics:

- `/anime/api/discover?year=2020` returns the unfiltered 22,513-title page.
  `seasonYear=2020` narrows to 877. Sending `year` is the trap.
- Every sort spelling tried (`sort`, `sort_by`, `order`, `sort_field`/`sort_type`,
  `sortBy=SCORE_DESC|popularity|…`) returns an identically ordered page; `sort=…`
  returns 400. There is **no server-side sort**, so the anime grid sorts the
  loaded rows in the browser and says so in the tooltip.
- There is no anime-only search: `/anime/api/search` 404s and the anime
  `discover` ignores a query parameter. Search uses the shared `/api/search`
  index, whose rows are keyed by TMDB id and resolve on the standard title
  route — so every result is playable.
- The unfiltered anime list is capped at 20 titles (`totalPages: 1`); it is
  paginated only when a genre or year filter is present.

`browseAnime` takes `{ genreSlug, year }` and does the slug→name mapping. The
filter bar stores the **slug**; storing the name renders identically and filters
nothing.

## Player: equaliser, gestures, subtitles

### Subtitle proxy (`app/api/subtitle`)

Catalogue subtitle files are third-party and usually SubRip. Both facts are
individually fatal to a `<track>`, and both fail **silently** — the element is
present, the settings menu lists the track, and no cue ever appears:

- The hosts send no `access-control-allow-origin`, so a cross-origin `<track>`
  is refused.
- `<track>` renders WebVTT only. An SRT file is parsed to zero cues.

So every track is routed through `/api/subtitle?url=…`, which fetches the file,
converts it (`toVtt` in `lib/subtitles.ts`) and serves it same-origin. Private,
loopback and non-http(s) targets are refused.

**When verifying subtitles, assert on cue text, not on the track list.** A
passing track count proves nothing here. Enable the track, seek into the film,
and read `textTracks[i].cues[n].text`. `hooks/useResolvedStream.ts` resolves
subtitles in the browser, so they never appear in the server-rendered HTML —
grepping a page for `/api/subtitle` will find nothing and is not a failure.

### Equaliser (`components/watch/video-controls/equalizer-panel.tsx`)

Graphic EQ over the Web Audio graph (`hooks/useAudioProcessing.ts`): 10 bands,
a live response curve on a canvas, 20 built-in presets plus viewer-saved ones,
preamp with auto-trim, bandwidth, balance, and a maximiser gain-reduction
meter. Preset ids map to i18n keys as `eq` + capitalised id (`bass` → `eqBass`),
so a new preset needs a key in every locale's
`watch.player.settings`.

The graph is built behind a user gesture — the browser refuses to start an
`AudioContext` otherwise. A headless run therefore logs an autoplay warning and
reports the EQ unavailable until the video is clicked. That is expected.

### Mobile gestures (`hooks/useMobileGestures.ts`)

Vertical drag on the left half is brightness, on the right half volume, each
with a side-anchored meter; horizontal is scrub with a `+Ns` HUD. Touch only —
mouse and pen are left to the tap and double-click handlers on the same
surface.

Two traps when testing this in a browser:

- **Dispatch at `document.elementFromPoint(x, y)`, not on an ancestor.** The
  listener is on the overlay; an event dispatched higher up never reaches it.
- **Brightness goes through React state and an effect; volume is written
  straight to the `<video>`.** Reading `video.style.filter` in the same tick as
  the `pointermove` reports `(none)` for a gesture that works. Await a tick
  between moves before asserting.

## Theme tokens

`app/globals.css` defines a three-step surface ramp, a border pair and a
two-step text ramp as raw custom properties, with a light ramp selected by
`prefers-color-scheme`. There is no toggle and no stored preference: the app
follows the device. `tailwind.config.ts` wraps each token in
`rgb(var(--x) / <alpha-value>)`, which is what makes `bg-surface-card/60`
resolve — a hex value would silently drop the opacity modifier.

Anything sitting on **artwork or video** must not read these tokens; those
surfaces are a photograph in both schemes and keep the fixed
`--surface-overlay` / `--ink-*` values. `scripts/migrate-theme-tokens.py` is the
one-shot migration that moved page chrome onto the tokens; it skips
`components/watch/**` and `components/movie-images/**` for exactly that reason.
