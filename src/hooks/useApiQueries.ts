import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnimeDetail, searchAnime } from '@/lib/anilist';
import { warmStream } from '@/lib/streamWarm';
import {
  discover,
  discoverAnime,
  getDetail,
  getMeta,
  getProviders,
  getSeason,
  getSubtitles,
  searchTitles,
  type DiscoverParams,
  type FxDetail,
  type FxEpisode,
  type FxList,
  type FxPage,
  type FxProvider,
  type FxSubtitle,
  type MediaType,
} from '@/lib/api';

/**
 * Every catalogue read, as a TanStack Query.
 *
 * Query keys, stale windows and retry counts mirror frameXTV.xyz's
 * `useApiQueries` / `DiscoveryRail` chunks:
 *
 *   discovery-rail       staleTime 900_000  (15 min), retry 3
 *   discovery-filtered   staleTime 300_000  ( 5 min), retry 3
 *   media-details        staleTime 600_000  (10 min), retry 3 (404 → no retry)
 *   tv-season            staleTime 600_000
 *   providers            staleTime 900_000
 *   meta                 staleTime 600_000
 *   subtitles            staleTime 1_800_000 (30 min)
 *   search               staleTime 300_000, keeps previous data while fetching
 *
 * They are kept identical so a home rail already cached by the catalogue is
 * reused when the same rail is opened on the browse page.
 */

export const STALE = {
  rail: 900_000,
  filtered: 300_000,
  detail: 600_000,
  providers: 900_000,
  meta: 600_000,
  subtitles: 1_800_000,
  search: 300_000,
} as const;

const GC_TIME = 1_800_000;

export interface RailOptions {
  genre?: string;
  year?: string;
  sort?: string;
  minRating?: string;
  season?: string;
  status?: string;
  seasonYear?: string;
}

function railKey(type: MediaType, category: string | undefined, opts: RailOptions) {
  return [
    'discovery-rail',
    type,
    category || 'all',
    opts.genre || '',
    opts.year || '',
    opts.sort || '',
    opts.minRating || '',
    opts.season || '',
    opts.status || '',
  ];
}

async function fetchRail(
  type: MediaType,
  category: string | undefined,
  opts: RailOptions
): Promise<FxList> {
  const page =
    type === 'anime'
      ? await discoverAnime({
          category,
          genre: opts.genre,
          seasonYear: opts.seasonYear ?? opts.year,
          season: opts.season,
          status: opts.status,
          sort: opts.sort,
          perPage: 20,
        })
      : await discover(type, {
          category,
          genre: opts.genre,
          year: opts.year,
          sort: opts.sort,
          minRating: opts.minRating,
          page: 1,
        });
  return {
    success: true,
    page: page.page,
    totalPages: page.totalPages,
    totalResults: page.totalItems,
    results: page.items,
    warning: page.warning,
  };
}

/**
 * One named home/browse rail.
 *
 * `initialData` lets the home payload pre-seed the rail so the row paints
 * without a second request (the reference does exactly this with
 * `queryClient.setQueryData`).
 */
export function useDiscoveryRail(
  type: MediaType,
  category: string | undefined,
  opts: RailOptions = {},
  enabled = true,
  initialData?: FxList
) {
  const hasInitial = Boolean(initialData?.success && Array.isArray(initialData.results) && initialData.results.length);
  return useQuery({
    queryKey: railKey(type, category, opts),
    queryFn: () => fetchRail(type, category, opts),
    enabled: enabled && !hasInitial,
    staleTime: STALE.rail,
    gcTime: GC_TIME,
    retry: 3,
    initialData: hasInitial ? initialData : undefined,
    initialDataUpdatedAt: 0,
  });
}

export interface FilterOptions extends RailOptions {
  page?: number;
}

/** A filtered grid page (the browse pages' "Filtered Discovery" view). */
export function useFilteredDiscovery(
  type: MediaType,
  filters: FilterOptions,
  enabled = true
): ReturnType<typeof useQuery<FxPage>> {
  const page = filters.page || 1;
  return useQuery({
    queryKey: [
      'discovery-filtered',
      type,
      filters.genre || '',
      filters.year || '',
      filters.sort || '',
      filters.minRating || '',
      filters.season || '',
      filters.seasonYear || '',
      filters.status || '',
      page,
    ],
    queryFn: () =>
      type === 'anime'
        ? discoverAnime({
            genre: filters.genre,
            seasonYear: filters.seasonYear || filters.year,
            season: filters.season,
            status: filters.status,
            sort: filters.sort,
            page,
            perPage: 24,
          })
        : discover(type, {
            genre: filters.genre,
            year: filters.year,
            sort: filters.sort,
            minRating: filters.minRating,
            page,
          }),
    enabled,
    staleTime: STALE.filtered,
    retry: 3,
  });
}

/** One title's full record (film/series via the backend, anime via AniList). */
export function useDetails(id: string | undefined, type: MediaType, enabled = true) {
  const clean = (id || '').trim();
  return useQuery({
    queryKey: ['media-details', type, clean],
    queryFn: () => getDetail(clean, type),
    enabled: enabled && Boolean(clean),
    staleTime: STALE.detail,
    retry: (count, error) => {
      const message = error instanceof Error ? error.message : '';
      if (/404|not found/i.test(message)) return false;
      return count < 3;
    },
  });
}

/** One season's episode list. */
export function useSeason(id: string | undefined, season: number, enabled = true) {
  const clean = (id || '').trim();
  return useQuery<FxEpisode[]>({
    queryKey: ['tv-season', clean, season],
    queryFn: () => getSeason(clean, season),
    enabled: enabled && Boolean(clean) && season >= 0,
    staleTime: STALE.detail,
    retry: 3,
  });
}

/** One anime's AniList record. */
export function useAnimeDetail(id: string | undefined, enabled = true) {
  const clean = (id || '').trim();
  return useQuery({
    queryKey: ['anime-details', clean],
    queryFn: () => getAnimeDetail(clean),
    enabled: enabled && Boolean(clean),
    staleTime: STALE.detail,
    retry: 3,
  });
}

/** The aggregator's server list. */
export function useProviders() {
  return useQuery<FxProvider[]>({
    queryKey: ['providers'],
    queryFn: getProviders,
    staleTime: STALE.providers,
  });
}

/**
 * Warm a title's stream while the trailer plays.
 *
 * The watch page renders the player in a same-origin iframe (`/embed/...`), and
 * an iframe is a separate JS context with its own TanStack cache — so warming
 * the host's cache alone would not save the embed anything. `warmStream` bridges
 * that gap through Cache Storage and `sessionStorage`; this hook is just the
 * component-facing wrapper so a detail page can hand it to `DetailHero`.
 *
 * The provider list comes from the same `/api/providers` query the watch page's
 * bar uses, so the pre-resolve covers exactly the servers the viewer can pick.
 */
export function useWarmStream(
  id: string | undefined,
  type: MediaType,
  season?: number,
  episode?: number,
  meta?: { title?: string; year?: string }
) {
  const clean = (id || '').trim();
  const providers = useProviders().data ?? [];
  const providerIds = useMemo(() => providers.map((provider) => provider.id), [providers]);
  const title = meta?.title;
  const year = meta?.year;
  return useCallback(() => {
    if (!clean) return;
    void warmStream(clean, type, {
      season,
      episode,
      title,
      year,
      providers: providerIds.map((id) => ({ id })),
    });
  }, [clean, type, season, episode, title, year, providerIds]);
}

/** Per-title metadata (title/year/poster). */
export function useMeta(
  id: string | undefined,
  type: MediaType,
  season = 1,
  episode = 1,
  enabled = true
) {
  const clean = (id || '').trim();
  return useQuery({
    queryKey: ['meta', type, clean, season, episode],
    queryFn: () => getMeta(clean, type, season, episode),
    enabled: enabled && Boolean(clean),
    staleTime: STALE.meta,
  });
}

/** Subtitle tracks. */
export function useSubtitles(
  id: string | undefined,
  type: MediaType,
  season = 1,
  episode = 1,
  enabled = true
) {
  const clean = (id || '').trim();
  return useQuery<FxSubtitle[]>({
    queryKey: ['subtitles', type, clean, season, episode],
    queryFn: () => getSubtitles(clean, type, season, episode),
    enabled: enabled && Boolean(clean),
    staleTime: STALE.subtitles,
  });
}

/** Keyword anime search; the backend proxy is tried first, then AniList. */
export function useAnimeSearch(query: string, enabled = true) {
  const clean = query.trim();
  return useQuery({
    queryKey: ['search-anime', clean],
    queryFn: () => searchAnime(clean),
    enabled: enabled && Boolean(clean),
    staleTime: STALE.search,
  });
}

/** Keyword search; keeps the previous page visible while the next loads. */
export function useSearch(query: string, type: 'all' | 'movie' | 'tv' = 'all', page = 1) {
  const clean = query.trim();
  return useQuery({
    queryKey: ['search', type, clean, page],
    queryFn: () => searchTitles(clean, type, page),
    enabled: Boolean(clean),
    staleTime: STALE.search,
    placeholderData: (previous: FxPage | undefined) => previous,
  });
}

export type { FxDetail };
