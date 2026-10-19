import type { FxItem, FxDetail, FxEpisode, FxSeason, FxAnimeItem, AniListMedia } from 'services/framextv-api';
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
// ANIME
// ============================================================================

/**
 * The catalogue's anime rows arrive from Kitsu, so they use Kitsu's field
 * names: the synopsis is `synopsis`, not `overview`. Normalizing here means
 * everything downstream — `adaptItem`, the cards, the detail page — reads one
 * shape and never has to know which upstream a row came from.
 */
export function normalizeAnimeItem(item: FxAnimeItem): FxItem {
  return { ...item, overview: item.overview ?? item.synopsis };
}

/**
 * An anime row → list item. Same mapping as any other title; the only anime
 * specific is that `type` is already `anime`, which `mediaTypeOf` understands,
 * so the minted slug tail is `anime-<anilistId>` and `parseMintedSlug` reads
 * it back.
 */
export function adaptAnimeItem(item: FxAnimeItem, opts: AdaptOptions): NewlyMovie {
  return adaptItem(normalizeAnimeItem(item), opts);
}

export function adaptAnimeItems(items: FxAnimeItem[], opts: AdaptOptions): NewlyMovie[] {
  return (items ?? [])
    .filter((item) => item?.id && item.title)
    .map((item) => adaptAnimeItem(item, opts));
}

/**
 * Build the detail view model for an anime from the catalogue row plus the
 * AniList record.
 *
 * Neither source alone is enough: the catalogue has the playable id, the
 * poster and the genre names; AniList has the runtime, the episode count, the
 * cast and a cleaner banner. `media` is optional because AniList is an
 * enhancement — a title it has never heard of still renders from the row.
 *
 * Episodes are synthesized as one entry per episode number. AniList exposes
 * no per-episode playable list (its `streamingEpisodes` are Crunchyroll
 * links, which are exactly the outbound redirect this app must not offer), so
 * the episode selector is built from the count and each entry resolves its
 * stream at play time through our own `/api/stream`.
 */
export function buildAnimeDetail(
  item: FxAnimeItem,
  media: AniListMedia | null,
  opts: AdaptOptions
): DetailMovie {
  const normalized = normalizeAnimeItem(item);
  const base = adaptItem(normalized, opts);

  const episodes = buildAnimeEpisodes(item.id, media?.episodes ?? undefined);
  const title = media?.title?.english || media?.title?.romaji || normalized.title;

  // AniList's banner is a wide, textless image; prefer it for the hero. The
  // catalogue's backdrop is a Kitsu cover, which is portrait-ish and crops
  // badly full-bleed.
  const banner = media?.bannerImage || normalized.backdrop || normalized.poster || '';

  const movie: Movie = {
    ...base,
    name: title,
    origin_name: media?.title?.romaji || normalized.title,
    thumb_url: media?.coverImage?.extraLarge || normalized.poster || base.thumb_url,
    poster_url: banner || base.poster_url || '',
    type: 'hoathinh',
    sub_docquyen: false,
    chieurap: false,
    time: media?.duration ? `${media.duration} phút/tập` : '',
    episode_current: animeStatusLabel(media),
    lang: 'Phụ đề',
    category: base.category ?? [],
    country: base.country ?? [],
    actor: (media?.characters?.edges ?? [])
      .map((edge) => edge.node?.name?.full)
      .filter((name): name is string => !!name)
      .slice(0, 20),
    director: [],
    content: stripHtml(media?.description) || normalized.overview || '',
    content_lang: 'en',
    status: media?.status === 'RELEASING' ? 'ongoing' : 'completed',
    episode_total: media?.episodes ?? undefined,
  };

  // The hero wants a TMDB-style path only when the artwork is actually TMDB's.
  // AniList banners are absolute AniList URLs, so `tmdb_backdrop` stays unset
  // and the raw URL rides in `poster_url` — which `next/image` loads through
  // our own resizer once `s4.anilist.co` is on the allow-list.
  movie.tmdb_backdrop = undefined;

  return { movie, episodes };
}

/** `"25 tập"` / `"Đang chiếu"` / `"Hoàn tất"` — whatever AniList can support. */
function animeStatusLabel(media: AniListMedia | null): string {
  if (!media) return '';
  if (media.status === 'RELEASING' && media.episodes) return `${media.episodes} tập`;
  if (media.episodes) return `Hoàn tất (${media.episodes}/${media.episodes})`;
  return media.status === 'RELEASING' ? 'Đang chiếu' : 'Hoàn tất';
}

/** One season, one entry per episode, plus the playable addresses. */
function buildAnimeEpisodes(id: string, count: number | undefined): Episode[] {
  const total = count && count > 0 ? Math.min(count, 2000) : 1;
  const data: Episode['server_data'] = [];
  for (let n = 1; n <= total; n++) {
    data.push({
      name: `Tập ${n}`,
      slug: String(n),
      filename: `tap-${n}`,
      link_m3u8: streamUrl(id, 'anime', 1, n),
      link_embed: embedUrl(id, 'anime', 1, n),
    });
  }
  return [{ server_name: 'Phần 1', server_data: data }];
}

/** AniList descriptions are HTML (`<br>`, `<i>`); the synopsis renders as text. */
function stripHtml(html: string | undefined): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================================
// DETAIL
// ============================================================================

/**
 * Our own resolver route: it 302s to the provider's playlist.
 *
 * `provider` pins the upstream aggregator to one of its servers (`bowler`,
 * `titan`, …). Without it the backend picks one itself, which is fine for the
 * default but leaves a viewer whose chosen server is failing with no way to
 * ask for another. The value travels to `/api/stream`, which forwards it.
 */
export function streamUrl(
  id: string,
  type: string,
  season?: number,
  episode?: number,
  provider?: string
): string {
  const params = new URLSearchParams({ id, type });
  if (season != null) params.set('season', String(season));
  if (episode != null) params.set('episode', String(episode));
  if (provider) params.set('provider', provider);
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
    status: mediaTypeOf(detail) === 'tv' ? 'ongoing' : 'completed',
    episode_total: detail.number_of_seasons,
  };

  return { movie, episodes };
}
