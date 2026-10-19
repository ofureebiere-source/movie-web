/**
 * External reviews for a title, from public sources that need no key.
 *
 * The app has no review data of its own. The catalogue is a TMDB proxy with no
 * reviews endpoint — every `/api/reviews*`, `/api/comments*` and
 * `/api/movie/{id}/reviews` path falls through to the backend's health payload
 * — and the in-page comment box is per-browser `localStorage`, so it is empty
 * for every first-time visitor. This module fills that gap from three sources,
 * all keyless and all sending `access-control-allow-origin: *` (verified), so
 * the browser calls them directly:
 *
 *  - **AniList** for anime. Its GraphQL API carries real user reviews, each
 *    with an author, a 0-100 score and a body. The id it needs is the AniList
 *    media id, which is exactly the tail of our own `anime-<id>` key.
 *  - **Wikipedia** for films and series. Its "Critical reception" /
 *    "Reception" section is a digest of the published reviews. The article is
 *    resolved by title and year rather than by an id: Wikipedia's TMDB-id
 *    property can only be queried through Wikidata's SPARQL endpoint, which
 *    rate-limits hard (429 "1 req / min" during development).
 *  - **TVmaze** for a series score, used when Wikipedia has no reception
 *    section to show.
 *
 * Everything here is best-effort. A title with no external coverage renders
 * nothing rather than an error, and nothing in this file is required for a
 * page to draw.
 */

import type Movie from 'types/movie';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const TVMAZE_ENDPOINT = 'https://api.tvmaze.com';

/**
 * Wikimedia asks clients to identify themselves; there is no key involved.
 *
 * Sent only to Wikipedia. AniList's CORS preflight allow-list does not include
 * `Api-User-Agent`, so sending it there fails the preflight and the browser
 * blocks the request outright — which is why this is passed per call rather
 * than set for every request.
 */
const WIKI_USER_AGENT = 'netflix-2.0/1.0 (title reviews; keyless)';

const TIMEOUT_MS = 12000;

/** Reviews and reception text change slowly; a day in the session cache is plenty. */
const REVALIDATE_SEC = 60 * 60 * 24;

/** Bump when `ExternalReview` changes shape, so a stale cache cannot mislead. */
const CACHE_VERSION = 'v1';
const CACHE_PREFIX = `reviews:${CACHE_VERSION}:`;
const inflight = new Map<string, Promise<ExternalReview[]>>();

export type ReviewSource = 'AniList' | 'Wikipedia' | 'TVmaze';

export interface ExternalReview {
  source: ReviewSource;
  /** Reviewer's display name, when the source names one. */
  author?: string;
  /** Score normalised to 0-100, when the source gives one. */
  score?: number;
  /** The source's own score wording, e.g. `"8.6/10"` — preferred for display. */
  scoreLabel?: string;
  /** Short headline, when the source has one. */
  title?: string;
  /** The review text, already stripped of markup. */
  body: string;
  /** Canonical page for this review or article. */
  url?: string;
}

// ============================================================================
// CACHE — the same shape the catalogue and person layers use
// ============================================================================

function readCache(key: string): ExternalReview[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; body: ExternalReview[] };
    if (Date.now() - parsed.at > REVALIDATE_SEC * 1000) {
      window.sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return parsed.body;
  } catch {
    return null;
  }
}

function writeCache(key: string, body: ExternalReview[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), body }));
  } catch {
    /* quota or private mode — the cache is an optimisation, never a requirement */
  }
}

// ============================================================================
// FETCH HELPERS
// ============================================================================

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { accept: 'application/json', ...(init?.headers ?? {}) },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// ANILIST — anime
// ============================================================================

interface AniListReview {
  id: number;
  summary?: string;
  body?: string;
  score?: number;
  rating?: number;
  siteUrl?: string;
  user?: { name?: string };
}

interface AniListResponse {
  data?: {
    Media?: {
      title?: { romaji?: string; english?: string };
      reviews?: { nodes?: AniListReview[] };
    } | null;
  };
  errors?: unknown;
}

const ANILIST_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    title { romaji english }
    reviews(perPage: 6, sort: RATING_DESC) {
      nodes { id summary body score rating siteUrl user { name } }
    }
  }
}`;

/**
 * The AniList media id, read from our own key.
 *
 * Anime list items and detail pages are keyed `anime-<anilistId>` — see
 * `adaptItem` — so the id is recoverable without a second lookup. Non-anime
 * keys (`movie-…`, `tv-…`) carry a TMDB id instead and must not be sent to
 * AniList, which would answer with an unrelated title.
 */
export function anilistIdOf(movie: Pick<Movie, '_id' | 'type'>): number | null {
  const match = /^anime-(\d+)$/.exec(movie._id ?? '');
  return match ? Number(match[1]) : null;
}

async function fetchAniListReviews(id: number): Promise<ExternalReview[]> {
  const body = await fetchJson<AniListResponse>(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { id } }),
  });

  const nodes = body?.data?.Media?.reviews?.nodes ?? [];
  const reviews: ExternalReview[] = [];
  for (const node of nodes) {
    // AniList reviews carry both a short `summary` and a long `body`; the
    // summary is the author's own abstract and reads well as the review, with
    // the body appended when the summary is empty or very short.
    const text = (node.summary ?? '').trim() || stripMarkup(node.body ?? '');
    if (!text) continue;
    reviews.push({
      source: 'AniList',
      author: node.user?.name,
      score: typeof node.score === 'number' ? node.score : undefined,
      scoreLabel: typeof node.score === 'number' ? `${node.score}/100` : undefined,
      body: text,
      url: node.siteUrl,
    });
  }
  return reviews;
}

/** AniList bodies contain a little Markdown and HTML; keep the prose only. */
function stripMarkup(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_>#`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// WIKIPEDIA — films and series
// ============================================================================

/** Locales the app serves, mapped to a Wikipedia subdomain. */
const WIKI_LANGS: Record<string, string> = { vi: 'vi', en: 'en' };

interface WikiSearchResponse {
  query?: { search?: { title: string }[] };
}

interface WikiExtractResponse {
  query?: { pages?: Record<string, { extract?: string }> };
}

/** Headings whose section holds review prose, best first. */
const CRITICAL_HEADING =
  /^=+\s*(critical (reception|response|reception and legacy|response and legacy)|reception and legacy|reception|response)\s*=+\s*$/i;

/**
 * Resolve the article for a title and pull its review section out.
 *
 * `intitle:` keeps the search on articles that actually carry the title in
 * their name, and the year plus the kind ("film" / "television series")
 * separates a work from its soundtrack, its list-of-episodes page and its
 * disambiguation page — all of which rank above or beside it otherwise.
 */
async function fetchWikipediaReception(
  title: string,
  year: number | undefined,
  kind: 'film' | 'television series',
  lang: string
): Promise<ExternalReview[]> {
  const search = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: `intitle:"${title}"${year ? ` ${year}` : ''} ${kind}`,
    srlimit: '5',
    format: 'json',
    origin: '*',
  });

  const found = await fetchJson<WikiSearchResponse>(
    `https://${lang}.wikipedia.org/w/api.php?${search.toString()}`,
    { headers: { 'Api-User-Agent': WIKI_USER_AGENT } }
  );
  const article = found?.query?.search?.[0]?.title;
  if (!article) return [];

  const extractParams = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    titles: article,
    format: 'json',
    origin: '*',
  });

  const page = await fetchJson<WikiExtractResponse>(
    `https://${lang}.wikipedia.org/w/api.php?${extractParams.toString()}`,
    { headers: { 'Api-User-Agent': WIKI_USER_AGENT } }
  );
  const pages = page?.query?.pages;
  if (!pages) return [];

  const extract = Object.values(pages)[0]?.extract ?? '';
  const section = extractReviewSection(extract);
  if (!section) return [];

  return [
    {
      source: 'Wikipedia',
      title: article,
      body: section,
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(article.replace(/ /g, '_'))}`,
    },
  ];
}

/**
 * The review section's prose, from a plain-text Wikipedia extract.
 *
 * Plain-text extracts render headings as `== Reception ==` lines, so the
 * section runs from a matching heading to the next heading of any level. A
 * "Reception" section usually opens with a "Box office" subsection, which is
 * grosses rather than reviews, so a leading box-office block is skipped when
 * a critical-response heading is not present to be preferred instead.
 */
function extractReviewSection(extract: string): string | null {
  const lines = extract.split('\n');
  const headingIndexes = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter((entry) => CRITICAL_HEADING.test(entry.line));

  if (headingIndexes.length === 0) return null;

  // Prefer a heading that names critical response; otherwise the first match.
  const chosen =
    headingIndexes.find((entry) => /critical|response/i.test(entry.line)) ?? headingIndexes[0];

  const body: string[] = [];
  for (let i = chosen.index + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^=+[^=]+=+\s*$/.test(line.trim())) break;
    body.push(line);
  }

  let text = body.join('\n').trim();
  // Drop a leading box-office subsection when it is all we would otherwise show.
  if (/^=+\s*box office\s*=+/i.test(text.split('\n')[0]?.trim() ?? '')) {
    text = text.split('\n').slice(1).join('\n').trim();
  }

  const trimmed = firstParagraphs(text, 1200);
  return trimmed || null;
}

/**
 * Trim to whole paragraphs within a character budget.
 *
 * A section is often a single long paragraph — plain-text extracts collapse a
 * paragraph's internal line breaks, so there is nothing to split on — which is
 * why the budget also cuts a single oversized paragraph, at a sentence
 * boundary, rather than only deciding between whole paragraphs.
 */
function firstParagraphs(text: string, budget: number): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);

  const out: string[] = [];
  let used = 0;
  for (const paragraph of paragraphs) {
    if (used >= budget) break;

    const room = budget - used;
    if (paragraph.length > room) {
      out.push(clipToSentence(paragraph, room));
      break;
    }
    out.push(paragraph);
    used += paragraph.length;
  }
  return out.join('\n\n');
}

/** Cut at the last sentence end within `limit`, never mid-word. */
function clipToSentence(text: string, limit: number): string {
  const slice = text.slice(0, limit);
  const lastStop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (lastStop > limit * 0.5) return slice.slice(0, lastStop + 1).trim();
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : limit).trim()}…`;
}

// ============================================================================
// TVMAZE — a series score
// ============================================================================

interface TVMazeShow {
  name?: string;
  url?: string;
  rating?: { average?: number | null };
}

async function fetchTVMazeScore(title: string): Promise<ExternalReview[]> {
  const show = await fetchJson<TVMazeShow>(
    `${TVMAZE_ENDPOINT}/singlesearch/shows?q=${encodeURIComponent(title)}`
  );
  const average = show?.rating?.average;
  if (typeof average !== 'number') return [];

  return [
    {
      source: 'TVmaze',
      author: show?.name,
      score: Math.round(average * 10),
      scoreLabel: `${average.toFixed(1)}/10`,
      body: '',
      url: show?.url,
    },
  ];
}

// ============================================================================
// ENTRY POINT
// ============================================================================

/**
 * Reviews for a title, best source first.
 *
 * Never throws: a source that is down, slow or has no coverage for this title
 * simply contributes nothing, and an empty array is a valid answer that the
 * UI renders as "no external reviews".
 */
export async function getExternalReviews(
  movie: Movie,
  locale: string
): Promise<ExternalReview[]> {
  const anilistId = anilistIdOf(movie);
  const cacheKey = anilistId
    ? `anime:${anilistId}`
    : `${movie.tmdb?.type ?? 'movie'}:${movie.tmdb?.id ?? movie.slug}`;

  const cached = readCache(cacheKey);
  if (cached) return cached;

  const running = inflight.get(cacheKey);
  if (running) return running;

  const task = (async (): Promise<ExternalReview[]> => {
    const reviews = anilistId
      ? await fetchAniListReviews(anilistId)
      : await fetchFilmAndTvReviews(movie, locale);

    writeCache(cacheKey, reviews);
    return reviews;
  })().finally(() => inflight.delete(cacheKey));

  inflight.set(cacheKey, task);
  return task;
}

async function fetchFilmAndTvReviews(movie: Movie, locale: string): Promise<ExternalReview[]> {
  const title = movie.name;
  const year = movie.year || undefined;
  const isSeries = movie.type === 'series' || movie.type === 'tvshows';

  const langs = Array.from(new Set([WIKI_LANGS[locale] ?? 'en', 'en']));

  for (const lang of langs) {
    const reception = await fetchWikipediaReception(
      title,
      year,
      isSeries ? 'television series' : 'film',
      lang
    );
    if (reception.length > 0) return reception;
  }

  // Wikipedia has nothing for this title. A series still gets a score.
  return isSeries ? fetchTVMazeScore(title) : [];
}
