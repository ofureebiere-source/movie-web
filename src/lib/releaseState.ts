import type { MediaType } from './api';

/**
 * "Has this title actually been released?" — ported from frameXTV.xyz's
 * `releaseState` chunk.
 *
 * The reference gates the Play button on this: a movie whose release date is in
 * the future, a series whose first air date is in the future, an episode whose
 * air date is in the future, or an AniList title with status
 * `NOT_YET_RELEASED` all render a disabled button with a "Not released yet"
 * tooltip instead of a player link. The date comparison is string-based for
 * `YYYY-MM-DD` and `YYYY-MM` so it does not shift with the viewer's timezone.
 */

export interface ReleaseState {
  isReleased: boolean;
  tooltipText: string;
}

/** True when `value` names a date strictly after today. */
export function isFutureDate(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const today = `${year}-${month}-${String(now.getDate()).padStart(2, '0')}`;

  const full = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (full) return `${full[1]}-${full[2]}-${full[3]}` > today;

  const monthOnly = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (monthOnly) return `${monthOnly[1]}-${monthOnly[2]}` > `${year}-${month}`;

  const yearOnly = trimmed.match(/^(\d{4})$/);
  if (yearOnly) return parseInt(yearOnly[1], 10) > year;

  const parsed = Date.parse(trimmed);
  return (
    !Number.isNaN(parsed) &&
    parsed > new Date(year, now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
  );
}

export function getReleaseState(input: {
  mediaType: MediaType;
  releaseDate?: string | null;
  status?: string | null;
  episodeAirDate?: string | null;
}): ReleaseState {
  const { mediaType, releaseDate, status, episodeAirDate } = input;
  const normalized = (status || '').trim().toUpperCase();
  const notYet: ReleaseState = { isReleased: false, tooltipText: 'Not released yet' };

  if (mediaType === 'anime') {
    if (normalized === 'NOT_YET_RELEASED') return notYet;
    if (isFutureDate(releaseDate)) return notYet;
    return { isReleased: true, tooltipText: '' };
  }

  if (mediaType === 'movie') {
    if (isFutureDate(releaseDate)) return notYet;
    if (!releaseDate && ['PLANNED', 'UPCOMING', 'IN PRODUCTION'].includes(normalized)) {
      return notYet;
    }
    return { isReleased: true, tooltipText: '' };
  }

  if (mediaType === 'tv') {
    if (isFutureDate(releaseDate)) return notYet;
    if (!releaseDate && ['PLANNED', 'UPCOMING'].includes(normalized)) return notYet;
    if (isFutureDate(episodeAirDate)) return notYet;
    return { isReleased: true, tooltipText: '' };
  }

  return { isReleased: true, tooltipText: '' };
}
