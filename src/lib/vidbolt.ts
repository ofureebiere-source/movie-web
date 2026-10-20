/**
 * The Vidbolt / VidUp backup player, ported from the reference.
 *
 * When every native provider fails to produce a source, the reference falls
 * back to an embedded third-party player rather than showing a dead frame. The
 * URL is built from the title's identifiers and carries the playhead and theme
 * so the fallback resumes where the viewer was.
 *
 * Movies and TV go to `vidup.to`; anime goes to `vidup.to/tv/<tmdb>` when a
 * TMDB id exists, otherwise `vidbolt.xyz/anime/...` by AniList or MAL id.
 */

export interface VidboltParams {
  mediaType: 'movie' | 'tv' | 'anime';
  tmdbId?: string;
  season?: number;
  episode?: number;
  anilistId?: string;
  malId?: string;
  autoPlay?: boolean;
  startTime?: number;
  autoNext?: boolean;
}

const THEME = 'e50914';

export function vidboltEmbedUrl({
  mediaType,
  tmdbId,
  season = 1,
  episode = 1,
  anilistId,
  malId,
  autoPlay = true,
  startTime = 0,
  autoNext = true,
}: VidboltParams): string | null {
  const start = startTime > 15 ? `&startAt=${Math.floor(startTime)}` : '';

  if (mediaType === 'anime') {
    if (tmdbId) {
      return `https://vidup.to/tv/${tmdbId.trim()}/${season}/${episode}?autoPlay=${autoPlay}&theme=${THEME}${start}&nextButton=true&autoNext=${autoNext}`;
    }
    if (malId) {
      return `https://vidbolt.xyz/anime/mal/${malId}/${episode}?autoPlay=${autoPlay}&theme=${THEME}${start}`;
    }
    if (anilistId) {
      return `https://vidbolt.xyz/anime/${anilistId}/${episode}?autoPlay=${autoPlay}&theme=${THEME}${start}`;
    }
    return null;
  }

  if (!tmdbId) return null;
  const id = tmdbId.trim();
  if (mediaType === 'tv') {
    return `https://vidup.to/tv/${id}/${season}/${episode}?autoPlay=${autoPlay}&theme=${THEME}${start}&nextButton=true&autoNext=${autoNext}`;
  }
  return `https://vidup.to/movie/${id}?autoPlay=${autoPlay}&theme=${THEME}${start}`;
}

/** Provider ids that mean "use the embedded backup player". */
export function isBackupProvider(provider?: string): boolean {
  if (!provider) return false;
  const id = provider.toLowerCase().trim();
  return id === 'backup' || id === 'vidbolt' || id === 'vidup_backup' || id.includes('backup') || id.includes('vidbolt');
}
