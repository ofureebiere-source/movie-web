import { readFile } from 'fs/promises';
import { join } from 'path';
import type { TrendingItem } from 'components/home/trending-slider';
import type { Locale } from 'i18n/routing';

interface TrendingMovie {
  slug: string;
  // Localized titles baked by scripts/fetch-trending.mjs:
  // - vi: source-API name (Vietnamese)
  // - en: TMDB official English name (null if no tmdb_id)
  title: { vi?: string; en?: string | null };
  poster_url: string | null;
  year?: number;
  tmdb_rating?: number | null;
  trending_score: number;
}

interface TrendingData {
  updated_at: string;
  interval_days: number;
  movies: TrendingMovie[];
}

// Locale-aware title picker. EN locale prefers TMDB English; falls back to
// Vietnamese if TMDB has no match for this title (e.g., movies without
// tmdb_id). VI locale always uses the Vietnamese source name.
function pickTitle(title: TrendingMovie['title'], locale: Locale): string {
  if (locale === 'en' && title?.en) return title.en;
  return title?.vi ?? title?.en ?? '';
}

/**
 * Build the trending row from the static file checked into `public/data`.
 *
 * Runs on the server so the JSON never ships as a separate request. A missing
 * or malformed file yields an empty row rather than an error: trending is
 * decoration, and the home page must render without it.
 */
export async function loadTrendingItems(locale: Locale): Promise<TrendingItem[]> {
  let movies: TrendingMovie[];
  try {
    const file = await readFile(join(process.cwd(), 'public', 'data', 'trending.json'), 'utf-8');
    movies = (JSON.parse(file) as TrendingData).movies ?? [];
  } catch {
    return [];
  }

  // poster_url is baked into trending.json by scripts/fetch-trending.mjs
  // (TMDB poster, then thumb_url fallback). Filter first, then assign ranks
  // — so missing-poster items don't produce gaps like "1, 3, 4, 7" in the UI.
  // Cap at 9: the rank badge is single-digit only, so a two-digit "10" would
  // render clipped behind the poster (looked like "1"). Keep it single-digit.
  return movies
    .filter((m): m is TrendingMovie & { poster_url: string } => Boolean(m.poster_url))
    .slice(0, 9)
    .map((m, i) => ({
      rank: i + 1,
      slug: m.slug,
      title: pickTitle(m.title, locale),
      poster_url: m.poster_url,
      year: m.year ?? 0,
      rating: m.tmdb_rating ?? 0,
    }));
}
