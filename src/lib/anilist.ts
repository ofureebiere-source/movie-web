import { apiBase } from './config';
import type { FxDetail, FxItem, FxPage } from './api';

/**
 * AniList, for anime metadata.
 *
 * Ported from frameXTV.xyz's `anilist` chunk. The anime catalogue (Kitsu,
 * fronted by AniList ids) carries only what a poster grid needs, so the detail
 * page's runtime, episode count, studios, characters and relations come from
 * AniList's public GraphQL API instead. Keyless and CORS-open.
 *
 * The reference tries its own `/api/anime/search` proxy first and only then
 * falls back to AniList directly; the same order is kept here.
 */

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const TIMEOUT_MS = 10_000;

interface AniListTitle {
  english?: string;
  romaji?: string;
  native?: string;
}

interface AniListMedia {
  id: number;
  title?: AniListTitle;
  coverImage?: { extraLarge?: string; large?: string; medium?: string };
  bannerImage?: string;
  description?: string;
  episodes?: number;
  nextAiringEpisode?: { episode?: number };
  format?: string;
  genres?: string[];
  averageScore?: number;
  season?: string;
  seasonYear?: number;
  status?: string;
  duration?: number;
  startDate?: { year?: number; month?: number; day?: number };
  studios?: { nodes?: { name?: string }[] };
  trailer?: { id?: string; site?: string };
  characters?: {
    edges?: {
      role?: string;
      node?: { id?: number; name?: { full?: string }; image?: { medium?: string; large?: string } };
    }[];
  };
  recommendations?: {
    nodes?: { mediaRecommendation?: AniListMedia | null }[];
  };
  relations?: {
    edges?: { relationType?: string; node?: AniListMedia | null }[];
  };
}

function stripHtml(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .trim();
}

function toItem(media: AniListMedia): FxItem {
  const id = String(media.id);
  return {
    id,
    type: 'anime',
    title: media.title?.english || media.title?.romaji || media.title?.native || 'Unknown Anime',
    poster: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium,
    backdrop: media.bannerImage || undefined,
    overview: stripHtml(media.description),
    year: media.seasonYear
      ? String(media.seasonYear)
      : media.startDate?.year
        ? String(media.startDate.year)
        : undefined,
    rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : undefined,
    genres: media.genres || [],
    episodeCount: media.episodes || undefined,
    anilistId: id,
  };
}

async function anilistQuery<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.status === 403 || res.status === 429 || !res.ok) {
      console.warn(`[AniList] Upstream HTTP ${res.status}`);
      return null;
    }
    const body = (await res.json()) as { data?: T; errors?: { message?: string }[] };
    if (body.errors && body.errors.length > 0) {
      console.warn('[AniList] GraphQL errors:', body.errors[0]?.message);
      return null;
    }
    return body.data ?? null;
  } catch (error) {
    clearTimeout(timer);
    console.warn('[AniList] Request failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

const SEARCH_QUERY = `
  query ($search: String, $page: Int, $perPage: Int, $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage perPage }
      media(search: $search, type: ANIME, isAdult: false, sort: $sort) {
        id
        title { english romaji native }
        coverImage { extraLarge large medium }
        bannerImage
        description
        episodes
        format
        genres
        averageScore
        seasonYear
        status
        startDate { year }
      }
    }
  }
`;

/** Keyword anime search. The backend proxy is tried first, then AniList. */
export async function searchAnime(
  query: string,
  page = 1,
  perPage = 24,
  sort: string[] = ['SEARCH_MATCH', 'POPULARITY_DESC']
): Promise<FxPage> {
  const trimmed = query.trim();
  if (!trimmed) return { items: [], page: 1, totalPages: 0, totalItems: 0 };

  try {
    const res = await fetch(
      `${apiBase()}/api/anime/search?q=${encodeURIComponent(trimmed)}&page=${page}&per_page=${perPage}`
    );
    if (res.ok) {
      const body = (await res.json()) as {
        success?: boolean;
        page?: number;
        totalPages?: number;
        totalResults?: number;
        results?: FxItem[];
      };
      if (body.success && Array.isArray(body.results)) {
        return {
          items: body.results,
          page: body.page ?? page,
          totalPages: body.totalPages ?? 1,
          totalItems: body.totalResults ?? body.results.length,
        };
      }
    }
  } catch {
    /* fall through to AniList */
  }

  const data = await anilistQuery<{
    Page?: { pageInfo?: { currentPage?: number; lastPage?: number; total?: number }; media?: AniListMedia[] };
  }>(SEARCH_QUERY, { search: trimmed, page, perPage, sort });

  const media = data?.Page?.media;
  if (media) {
    const items = media.map(toItem);
    return {
      items,
      page: data?.Page?.pageInfo?.currentPage ?? page,
      totalPages: data?.Page?.pageInfo?.lastPage ?? 1,
      totalItems: data?.Page?.pageInfo?.total ?? items.length,
    };
  }
  return { items: [], page: 1, totalPages: 0, totalItems: 0 };
}

const DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME, isAdult: false) {
      id
      title { english romaji native }
      coverImage { extraLarge large medium }
      bannerImage
      description
      episodes
      nextAiringEpisode { episode }
      format
      genres
      averageScore
      season
      seasonYear
      status
      duration
      startDate { year month day }
      studios(isMain: true) { nodes { name } }
      trailer { id site }
      characters(sort: [ROLE, RELEVANCE], perPage: 12) {
        edges { role node { id name { full } image { medium large } } }
      }
      recommendations(perPage: 12) {
        nodes {
          mediaRecommendation {
            id
            title { english romaji native }
            coverImage { large medium }
            bannerImage
            format
            averageScore
            seasonYear
            genres
            episodes
          }
        }
      }
      relations {
        edges {
          relationType
          node {
            id
            title { english romaji native }
            coverImage { large medium }
            format
            status
            averageScore
            seasonYear
            season
            episodes
            startDate { year month day }
          }
        }
      }
    }
  }
`;

/**
 * One anime's AniList record, reshaped as `FxDetail`.
 *
 * `null` on any failure — a title with no AniList record still renders from the
 * catalogue's own data, so this is an enhancement, never a gate.
 */
export async function getAnimeDetail(id: string): Promise<FxDetail | null> {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  const data = await anilistQuery<{ Media?: AniListMedia }>(DETAIL_QUERY, { id: numericId });
  const media = data?.Media;
  if (!media) return null;

  const base = toItem(media);
  const recommendations = (media.recommendations?.nodes ?? [])
    .map((node) => node.mediaRecommendation)
    .filter((entry): entry is AniListMedia => Boolean(entry))
    .map(toItem);
  const related: FxItem[] = [];
  for (const edge of media.relations?.edges ?? []) {
    if (!edge.node) continue;
    related.push({ ...toItem(edge.node), relationType: edge.relationType || undefined });
  }

  const start = media.startDate;
  const releaseDate = start?.year
    ? `${start.year}-${String(start.month ?? 1).padStart(2, '0')}-${String(start.day ?? 1).padStart(2, '0')}`
    : undefined;

  return {
    ...base,
    success: true,
    type: 'anime',
    originalTitle: media.title?.native || media.title?.romaji || undefined,
    runtime: media.duration ?? undefined,
    status: media.status,
    episodes: media.episodes ?? undefined,
    numberOfEpisodes: media.episodes ?? undefined,
    releaseDate,
    studios: (media.studios?.nodes ?? []).map((n) => n.name || '').filter(Boolean),
    trailer: media.trailer,
    cast: (media.characters?.edges ?? []).map((edge) => ({
      id: edge.node?.id,
      name: edge.node?.name?.full || 'Unknown',
      character: edge.role,
      profile: edge.node?.image?.large || edge.node?.image?.medium,
    })),
    recommendations,
    relatedAnime: related,
  };
}
