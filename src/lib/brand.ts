/**
 * The site's own name, in one place.
 *
 * The UI chrome, the wordmark, the footer, the install banner and the welcome
 * modal all read from here, so a rename is one edit rather than eight. The
 * visual treatment of the wordmark (a solid badge with two initials, followed
 * by a two-tone wordmark) is the one frameXTV.xyz uses; only the string is
 * ours.
 */
export const SITE_NAME = 'Netflix-pro';

export const WORDMARK_LEAD = 'Netflix';
export const WORDMARK_ACCENT = '-pro';

/** The two letters on the square badge that precedes the wordmark. */
export const BADGE_INITIALS = 'NP';

export const TAGLINE = 'Decrypted Stream Discovery Platform';

/** The companion mobile app the install banner points at. */
export const APP_RELEASES_URL = 'https://github.com/King-Fisher000/netflix-pro/releases';
export const APP_DOWNLOAD_URL =
  'https://github.com/King-Fisher000/netflix-pro/releases/download/android-apk-fix/android-sdk-setup-tools/app-debug.apk';

/** Support address shown in the footer / profile. */
export const SUPPORT_EMAIL = 'support@netflix-pro.com';

/** Document title for a route. */
export function pageTitle(suffix?: string): string {
  return suffix ? `${suffix} — ${SITE_NAME}` : SITE_NAME;
}
