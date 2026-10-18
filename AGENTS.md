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

`services/framextv-api.ts` talks to the framextv backend; `lib/catalog-client.ts`
fetches it **in the browser**, because the provider blocks datacenter IPs and the
Vercel runtime is one. `NEXT_PUBLIC_CATALOG_API_BASE` (falling back to
`CATALOG_API_BASE`) sets the base and must carry the `NEXT_PUBLIC_` prefix or
Next will not inline it into the client bundle. `components/commons/prefetch-link.tsx`
warms a browse page on hover/focus so it paints with rows instead of a skeleton.


## Images

`next.config.mjs` uses a **custom** loader (`image-loader.ts`) that routes every
image through `app/api/image` (self-hosted `sharp`), deliberately not Vercel's
metered Image Optimization API. `app/api/image/route.ts` re-validates host and
width independently and allows only `image.tmdb.org`, `phimimg.com` and
`lh3.googleusercontent.com`. If images 404, suspect that allow-list or `sharp`.
