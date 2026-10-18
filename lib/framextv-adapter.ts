import type { FxItem, FxDetail, FxEpisode, FxSeason } from 'services/framextv-api';
import { genreSlugForName, genreIdForSlug } from 'constants/framextv-taxonomy';
import { CATEGORY_MAP, COUNTRY_MAP } from 'constants/i18n-mappings';
import type NewlyMovie from 'types/newly-movie';
import type Movie from 'types/movie';
import type DetailMovie from 'types/detail-movie';
import type Episode from 'types/episode';
import type Category from 'types/category';
import type Country from 'types/country';
import type Tmdb from 'types/tmdb';

/**
 * framextv rows → the app's view model.
 *
 * The view model descends from a different provider, so the mapping is mostly
 * renames plus three decisions worth stating:
 *
 *  - **Slugs are minted here.** The provider addresses titles by numeric id
 *    and `type`, and has no slug. `title-slug-type-id` gives a readable,
 *    stable, collision-free URL whose tail `parseSlug` already understands —
 *    so an id is always recoverable without a lookup table.
 *  - **`tmdb_backdrop` is a PATH, not a URL.** The hero and player feed it to
 *    `tmdbBackdropLoader`, which prepends the TMDB base itself. The provider
 *    hands back absolute URLs, so the path is extracted — and left undefined
 *    for non-TMDB artwork (anime posters come from Kitsu).
 *  - **Episodes carry two addresses.** `link_m3u8` points at our own
 *    `/api/stream`, which resolves the provider's playlist and redirects to
 *    it (the playlist is token-bound and short-lived, so it cannot be baked
 *    in at render time). `link_embed` is the provider's own player, the
 *    fallback the watch page already knows how to switch to.
 */

// ============================================================================
// SLUGS
// ============================================================================

/** Diacritics off, punctuation to dashes: "Bí Ẩn" → "bi-an". */
export function slugifyTitle(title: string): string {
  return (title ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** `null` when the provider gave nothing usable to address the row by. */
export function mediaTypeOf(item: Pick<FxItem, 'type'>): 'movie' | 'tv' | 'anime' {
  if (item.type === 'tv') return 'tv';
  if (item.type === 'anime') return 'anime';
  return 'movie';
}

export function slugFor(item: Pick<FxItem, 'id' | 'title' | 'type'>): string {
  const type = mediaTypeOf(item);
  const base = slugifyTitle(item.title) || 'title';
  // `anime` has no `parseSlug` tail; the id is still the last segment, which
  // is what the resolver reads for every type.
  return `${base}-${type}-${item.id}`;
}

/**
 * Read `id` and `type` back out of a minted slug.
 *
 * Deliberately tolerant: the title part may be empty or stale (a renamed
 * title), and only the tail matters. Returns null for a slug with no tail,
 * which is every pre-existing URL from an earlier provider.
 */
export function parseMintedSlug(slug: string | undefined | null): { id: string; type: string } | null {
  if (!slug) return null;
  const match = /(?:^|-)(movie|tv|anime)-(\d+)$/.exec(slug);
  return match ? { type: match[1], id: match[2] } : null;
}

// ============================================================================
// SMALL HELPERS
// ============================================================================

function toNumber(value: string | number | null | undefined): number {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function yearOf(item: Pick<FxItem, 'year'>): number {
  const y = parseInt(String(item.year ?? ''), 10);
  return Number.isFinite(y) ? y : 0;
}

/** The bare TMDB path behind an absolute artwork URL, or undefined. */
export function tmdbPathFromUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  const match = /image\.tmdb\.org\/t\/p\/[^/]+(\/.+)$/.exec(url);
  return match ? match[1] : undefined;
}

function toCategories(names: string[] | undefined, locale: string): Category[] {
  const seen = new Set<string>();
  const out: Category[] = [];
  for (const name of names ?? []) {
    const slug = genreSlugForName(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({
      id: String(genreIdForSlug(slug)),
      name: CATEGORY_MAP[locale as 'vi' | 'en']?.[slug] ?? name,
      slug,
    });
  }
  return out;
}

function toCountries(locale: string): Country[] {
  // The provider exposes no country data at all. The heading on a country
  // page still names the country; the title itself just cannot claim one.
  return [];
}

function toTmdb(item: FxItem): Tmdb {
  const type = mediaTypeOf(item);
  return {
    // Kitsu ids are not TMDB ids, so anime deliberately carries none.
    id: type === 'anime' ? null : String(item.id),
    type: type === 'anime' ? null : type,
    season: null,
    vote_average: toNumber(item.rating),
    vote_count: 0,
  };
}

function typeField(item: FxItem): string {
  const type = mediaTypeOf(item);
  if (type === 'tv') return 'series';
  if (type === 'anime') return 'hoathinh';
  return 'single';
}

// ============================================================================
// LIST ITEMS
// ============================================================================

export interface AdaptOptions {
  locale: string;
}

export function adaptItem(item: FxItem, opts: AdaptOptions): NewlyMovie {
  const poster = item.poster || item.image || '';
  const backdrop = item.backdrop || '';
  return {
    _id: `${mediaTypeOf(item)}-${item.id}`,
    name: item.title,
    slug: slugFor(item),
    origin_name: item.title,
    thumb_url: poster,
    poster_url: backdrop || poster,
    year: yearOf(item),
    tmdb: toTmdb(item),
    type: typeField(item),
    sub_docquyen: false,
    chieurap: false,
    lang: 'Phụ đề',
    category: toCategories(item.genres, opts.locale),
    country: toCountries(opts.locale),
    tmdb_backdrop: tmdbPathFromUrl(backdrop),
  };
}

export function adaptItems(items: FxItem[], opts: AdaptOptions): NewlyMovie[] {
  return (items ?? [])
    .filter((item) => item?.id && item.title)
    .map((item) => adaptItem(item, opts));
}

// ============================================================================
// DETAIL
// ============================================================================

/** Our own resolver route: it 302s to the provider's playlist. */
export function streamUrl(id: string, type: string, season?: number, episode?: number): string {
  const params = new URLSearchParams({ id, type });
  if (season != null) params.set('season', String(season));
  if (episode != null) params.set('episode', String(episode));
  return `/api/stream?${params.toString()}`;
}

/**
 * The provider's own player, used as the fallback iframe.
 *
 * The embed ships an ad-injection script (`im.frshery.com`) that it only arms
 * when the frame's ancestors, referrer or parent origin are NOT its own host —
 * i.e. exactly when a third-party site embeds it, which is our case. It reads
 * a `no_ads=1` query flag before anything else and returns early, so every
 * embed we build carries it. Without it the provider pop-unders the visitor
 * out of the app.
 *
 * This is a request the provider honours, not something we can enforce: the
 * frame is cross-origin, so if the flag is ever ignored the sandbox attribute
 * in `vidsrc-player.tsx` is the backstop.
 */
export function embedUrl(id: string, type: string, season?: number, episode?: number): string {
  const base = 'https://framextv.xyz';
  const noAds = 'no_ads=1';
  if (type === 'anime') {
    return `${base}/embed/anime?id=${id}&type=anime&season=1&episode=${episode ?? 1}&${noAds}`;
  }
  if (type === 'tv' && season != null && episode != null) {
    return `${base}/embed/tv/${id}/${season}/${episode}?${noAds}`;
  }
  return `${base}/embed/${type}/${id}?${noAds}`;
}

function toEpisode(
  item: FxEpisode,
  index: number,
  id: string,
  type: string,
  seasonNumber: number
): Episode['server_data'][number] {
  const number = item.episode_number ?? item.number ?? index + 1;
  return {
    name: item.name || `Tập ${number}`,
    slug: String(number),
    filename: `${slugifyTitle(item.name || String(number))}-${number}`,
    link_m3u8: streamUrl(id, type, seasonNumber, number),
    link_embed: embedUrl(id, type, seasonNumber, number),
  };
}

/**
 * Seasons → the `Episode[]` the watch page renders.
 *
 * The outer array is the season selector and `server_data` the episode list —
 * the two controls the page already had. Specials (season 0) are dropped:
 * they are behind-the-scenes material with no playable source on the
 * provider, and Game of Thrones alone carries 300 phantom entries there.
 *
 * A season with no episodes is dropped rather than rendered as an empty
 * selector.
 */
export function buildSeasons(
  id: string,
  type: string,
  seasons: { season: FxSeason; episodes: FxEpisode[] }[]
): Episode[] {
  return seasons
    .filter(({ season }) => (season.season_number ?? 0) > 0)
    .filter(({ episodes }) => episodes.length > 0)
    .sort((a, b) => (a.season.season_number ?? 0) - (b.season.season_number ?? 0))
    .map(({ season, episodes }) => ({
      server_name: season.name || `Phần ${season.season_number}`,
      server_data: episodes.map((ep, i) => toEpisode(ep, i, id, type, season.season_number)),
    }));
}

/** A film: exactly one entry, one episode. */
export function buildMovieEpisodes(id: string, type: string, runtime?: number): Episode[] {
  const label = runtime && runtime > 0 ? `Full (${runtime} phút)` : 'Full';
  return [
    {
      server_name: 'Full',
      server_data: [
        {
          name: label,
          slug: 'full',
          filename: 'full',
          link_m3u8: streamUrl(id, type),
          link_embed: embedUrl(id, type),
        },
      ],
    },
  ];
}

export function adaptDetail(
  detail: FxDetail,
  episodes: Episode[],
  opts: AdaptOptions
): DetailMovie {
  const base = adaptItem(detail, opts);
  const trailer = (detail.videos ?? detail.trailers ?? []).find(
    (v) => (v.site ?? 'YouTube').toLowerCase() === 'youtube' && v.type !== 'Teaser'
  );

  const movie: Movie = {
    ...base,
    poster_url: base.poster_url || base.thumb_url,
    type: base.type ?? 'single',
    sub_docquyen: false,
    chieurap: false,
    time: detail.runtime ? `${detail.runtime} phút` : '',
    episode_current: '',
    lang: 'Phụ đề',
    category: base.category ?? [],
    country: base.country ?? [],
    actor: (detail.cast ?? []).map((c) => c.name).filter(Boolean),
    director: [],
    content: detail.overview ?? '',
    // The provider writes every synopsis in English; recording that lets the
    // localizer decide whether the `vi` view needs a translation.
    content_lang: 'en',
    trailer_url: trailer?.key ? `https://www.youtube.com/watch?v=${trailer.key}` : '',
    status: mediaTypeOf(detail) === 'tv' ? 'ongoing' : 'completed',
    episode_total: detail.number_of_seasons,
  };

  return { movie, episodes };
}
