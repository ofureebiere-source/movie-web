/**
 * The backup player.
 *
 * Main playback is the provider's own m3u8, streamed through our `/api/stream`
 * resolver so the playlist's short-lived token is fetched at play time rather
 * than baked into the page. When that can't be reached — the CDN is down, the
 * viewer's network blocks it — the watch page falls back to the provider's own
 * embed, which is a self-contained player.
 *
 * Both are the same provider and both are keyless. There is no third-party
 * embed here any more: the previous build pointed this at an external service
 * addressed by TMDB id, which is neither needed nor available now.
 *
 * Only the embed's ORIGIN matters to the app, because that is the origin its
 * `postMessage` events will carry.
 */

/** The provider's site, which serves the embed and the player events. */
export const PLAYER_ORIGIN = 'https://framextv.xyz';

/**
 * The origin every player `postMessage` must come from.
 *
 * Events from any other origin are another page on the site, or an attacker,
 * and must be ignored.
 */
export function vidsrcOrigin(): string {
  return PLAYER_ORIGIN;
}

/**
 * Subtitle language preference for a locale.
 *
 * The provider ships 60+ subtitle tracks per title and tags them by language,
 * so the viewer's own language is worth asking for first, with English as the
 * near-universal fallback.
 */
export function subtitleLanguagesFor(locale: string | undefined): string[] {
  return locale === 'vi' ? ['vi', 'en'] : ['en'];
}
