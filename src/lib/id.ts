/**
 * Title-id normalisation, ported from frameXTV.xyz.
 *
 * The reference accepts a bare TMDB id and an id-with-slug interchangeably
 * (`1198654` and `1198654-bad-apples` both resolve). Its helper is:
 *
 *   function id(e){ if(!e) return ''; const t=String(e).trim();
 *     const n=t.match(/^(\d+)(?:-.*)?$/); return n ? n[1] : t }
 *
 * so the leading digit run wins and anything else passes through untouched.
 */

/** Strip a trailing slug from a numeric id; leave non-numeric ids alone. */
export function extractId(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d+)(?:-.*)?$/);
  return match ? match[1] : trimmed;
}

/** `extractId` with a fallback to the raw value, matching the reference's `mediaId`. */
export function mediaId(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const trimmed = String(value).trim();
  return extractId(trimmed) || trimmed;
}

/**
 * Whether a title is on the provider's unavailable list.
 *
 * The reference consults a remotely-populated block set; this port ships no
 * such list, so nothing is ever flagged. Kept as a function because the detail
 * pages branch on it and the call sites should stay recognisable.
 */
export function isUnavailable(_id?: string | number | null, _type?: string): boolean {
  return false;
}
