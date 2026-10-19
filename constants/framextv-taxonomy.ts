/**
 * App taxonomy ↔ framextv.xyz.
 *
 * The site's menus, routes and chips still speak the Vietnamese slugs the
 * view model was written against (`hanh-dong`, `phim-bo`, …). The provider
 * speaks TMDB genre IDs and a single `type` (movie / tv / anime). This file
 * is the translation, and the single place that knows both vocabularies.
 *
 * Why a static map rather than the live list: `/api/genres` returns TMDB's
 * raw genre objects (id + English name), which is the wrong vocabulary for
 * the UI and carries no slug. The slug lists stay authoritative here; the
 * live endpoint is used only for drift checks (`getGenres()` in
 * `services/framextv-api`).
 *
 * Verified against `GET /api/genres?type=movie|tv` on 2026-10-18.
 */

// ============================================================================
// GENRES
// ============================================================================

/**
 * App genre slug → TMDB genre id on the provider.
 *
 * Where the provider has no equivalent the closest genre is used rather than
 * leaving the page unfiltered, which would silently show the whole catalogue
 * under a genre heading. `phim-ngan` (shorts) has no equivalent at all and is
 * hidden below instead.
 */
export const GENRE_ID: Record<string, number> = {
  'hanh-dong': 28, // Action
  'phieu-luu': 12, // Adventure
  'hai-huoc': 35, // Comedy
  'chinh-kich': 18, // Drama
  'gay-can': 53, // Thriller
  'tinh-cam': 10749, // Romance
  'kinh-di': 27, // Horror
  'bi-an': 9648, // Mystery
  'hinh-su': 80, // Crime
  'vien-tuong': 878, // Science Fiction
  'than-thoai': 14, // Fantasy
  'co-trang': 36, // History — "period"
  'vo-thuat': 28, // Action — "martial arts"
  'chien-tranh': 10752, // War
  'lich-su': 36, // History
  'gia-dinh': 10751, // Family
  'tre-em': 10762, // Kids
  'hoc-duong': 10751, // Family — "school"
  'the-thao': 99, // Documentary — "sports"
  'am-nhac': 10402, // Music
  'tai-lieu': 99, // Documentary
  'khoa-hoc': 99, // Documentary — "science"
  'kinh-dien': 18, // Drama — "classics"
  'mien-tay': 37, // Western
};

/** Genres offered in the header menu and filter bar, in display order. */
export const BROWSE_GENRE_SLUGS: string[] = [
  'hanh-dong',
  'phieu-luu',
  'hai-huoc',
  'chinh-kich',
  'gay-can',
  'tinh-cam',
  'kinh-di',
  'bi-an',
  'hinh-su',
  'vien-tuong',
  'than-thoai',
  'co-trang',
  'vo-thuat',
  'chien-tranh',
  'lich-su',
  'gia-dinh',
  'tre-em',
  'hoc-duong',
  'the-thao',
  'am-nhac',
  'tai-lieu',
  'khoa-hoc',
  'kinh-dien',
  'mien-tay',
];

const GENRE_SET: ReadonlySet<string> = new Set(Object.keys(GENRE_ID));

/** True for a genre slug the site shows and can actually filter on. */
export function isBrowsableGenre(slug: string | undefined | null): boolean {
  return !!slug && GENRE_SET.has(slug);
}

/**
 * The provider's genre NAME → app slug.
 *
 * `genres` on a detail row are TMDB display names ("Sci-Fi & Fantasy"), not
 * ids, so chips are built by name. Names with no app equivalent (News,
 * Reality, Talk, Soap, TV Movie) are dropped rather than shown as a chip that
 * leads nowhere — the same rule the previous provider's adapter used for
 * TMDB's leaking English slugs.
 */
const NAME_TO_SLUG: Record<string, string> = {
  Action: 'hanh-dong',
  Adventure: 'phieu-luu',
  Animation: 'hoat-hinh',
  Comedy: 'hai-huoc',
  Crime: 'hinh-su',
  Documentary: 'tai-lieu',
  Drama: 'chinh-kich',
  Family: 'gia-dinh',
  Fantasy: 'than-thoai',
  History: 'lich-su',
  Horror: 'kinh-di',
  Music: 'am-nhac',
  Mystery: 'bi-an',
  Romance: 'tinh-cam',
  'Science Fiction': 'vien-tuong',
  'Sci-Fi & Fantasy': 'vien-tuong',
  Thriller: 'gay-can',
  War: 'chien-tranh',
  'War & Politics': 'chien-tranh',
  Western: 'mien-tay',
  'Action & Adventure': 'hanh-dong',
  Kids: 'tre-em',
};

export function genreSlugForName(name: string | undefined | null): string | undefined {
  if (!name) return undefined;
  return NAME_TO_SLUG[name.trim()];
}

/** Stable id for a chip built from a genre name. */
export function genreIdForSlug(slug: string): number {
  return GENRE_ID[slug] ?? 0;
}

// ============================================================================
// FORMATS  (curated browse lists)
// ============================================================================

/**
 * A format as the provider understands it.
 *
 * `type` is required — the provider has no unfiltered list — so every format
 * resolves to at least a media type. `genre` / `year` narrow it further where
 * the provider supports it (it ignores country, sort and audio filters).
 */
export interface FormatSpec {
  type: 'movie' | 'tv' | 'anime';
  genre?: number;
  /** `'current'` resolves to the current year at call time. */
  year?: 'current';
}

export const FORMAT_SPEC: Record<string, FormatSpec> = {
  'phim-le': { type: 'movie' },
  'phim-bo': { type: 'tv' },
  'hoat-hinh': { type: 'movie', genre: 16 },
  'tv-shows': { type: 'tv' },
  // "Theatrical" and the audio-track lists have no provider filter; they are
  // the film catalogue, differentiated by year where the provider allows it.
  'phim-chieu-rap': { type: 'movie', year: 'current' },
  'phim-thuyet-minh': { type: 'movie' },
  'phim-long-tieng': { type: 'movie' },
};

export const FORMAT_SLUGS: string[] = Object.keys(FORMAT_SPEC);

/** The header-menu formats. Same four as before, so old links keep working. */
export const BROWSE_FORMAT_SLUGS = ['phim-le', 'phim-bo', 'hoat-hinh', 'tv-shows'] as const;

export function isKnownFormat(slug: string | undefined | null): boolean {
  return !!slug && slug in FORMAT_SPEC;
}

/** Resolve a format's spec, substituting the current year where asked. */
export function resolveFormat(slug: string): FormatSpec | null {
  const spec = FORMAT_SPEC[slug];
  if (!spec) return null;
  return spec.year === 'current' ? { ...spec, year: undefined, yearValue: new Date().getFullYear() } as FormatSpec & { yearValue: number } : spec;
}

// ============================================================================
// COUNTRIES
// ============================================================================

/**
 * Country slugs, kept so `/movies/country/*` links and bookmarks resolve.
 *
 * The provider IGNORES every country parameter it accepts (`country`,
 * `with_origin_country`, `region`, `with_original_language` — all verified to
 * return an identical page). Rather than pretend to filter, a country page
 * shows the film catalogue and its heading still names the country. The
 * alternative — 404-ing 36 routes that used to work — is worse for the
 * visitor and for search engines.
 */
export const COUNTRY_SLUGS: string[] = [
  'viet-nam',
  'au-my',
  'han-quoc',
  'trung-quoc',
  'nhat-ban',
  'thai-lan',
  'dai-loan',
  'hong-kong',
  'an-do',
  'anh',
  'phap',
  'duc',
  'y',
  'tay-ban-nha',
  'canada',
  'uc',
  'nga',
  'tho-nhi-ky',
  'indonesia',
  'philippines',
  'malaysia',
  'mexico',
  'brazil',
  'ha-lan',
  'ba-lan',
  'thuy-dien',
  'dan-mach',
  'na-uy',
  'thuy-si',
  'bo-dao-nha',
  'ukraina',
  'nam-phi',
  'chau-phi',
  'a-rap-xe-ut',
  'uae',
  'quoc-gia-khac',
];

/** Countries offered in the menus and filter bar, in display order. */
export const BROWSE_COUNTRY_SLUGS: string[] = COUNTRY_SLUGS.slice(0, 20);

const COUNTRY_SET: ReadonlySet<string> = new Set(COUNTRY_SLUGS);

export function isKnownCountry(slug: string | undefined | null): boolean {
  return !!slug && COUNTRY_SET.has(slug);
}

// ============================================================================
// LEGACY SLUGS  (earlier eras → the current taxonomy)
// ============================================================================

export const LEGACY_GENRE_REDIRECTS: Record<string, string> = {
  'gia-tuong': 'than-thoai', // Fantasy → Mythology
  'tam-ly': 'gay-can', // "Psychological" was Thriller's slug in the keyless era
  'thieu-nhi': 'tre-em', // Kids
};

export const LEGACY_COUNTRY_REDIRECTS: Record<string, string> = {
  'hoa-ky': 'au-my',
};

// ============================================================================
// SORT & AUDIO FILTERS
// ============================================================================

/**
 * The provider ignores every sort parameter, so the filter bar's year sort
 * cannot be honoured. It is dropped rather than faked over one page: a
 * client-side sort of 30 rows would look like a broken control.
 */
export function sortParams(_sort: string | undefined): Record<string, never> {
  return {};
}

export const LANG_FILTER_SLUGS = ['vietsub', 'thuyet-minh', 'long-tieng'] as const;
export type LangFilter = (typeof LANG_FILTER_SLUGS)[number];

export function isLangFilter(value: string | undefined | null): value is LangFilter {
  return !!value && (LANG_FILTER_SLUGS as readonly string[]).includes(value);
}

/** The provider filters nothing by audio track; accepted and ignored. */
export function langFilterParams(_lang: string | undefined): Record<string, never> {
  return {};
}
