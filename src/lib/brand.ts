/**
 * The site's own name, in one place.
 *
 * The wordmark is the reference's: a square `fX` badge next to `frame` + a
 * muted `X` + `TV`. The token, social and support links are the reference's
 * too, so the chrome reads identically.
 *
 * Two things are deliberately ours and do not exist upstream:
 *
 *   APP_*        the companion mobile app this site ships, served straight
 *                from the netflix-pro GitHub releases.
 *   SUPPORT_EMAIL
 */

export const SITE_NAME = 'frameXTV';
export const SITE_LEAD = 'frame';
export const SITE_MIDDLE = 'X';
export const SITE_TAIL = 'TV';

/** The square badge glyph in the header, footer and welcome modal. */
export const BADGE = 'fX';

export const TAGLINE = 'Decrypted Stream Discovery Platform';

/** The reference's own links. */
export const X_URL = 'https://x.com/frameXTV';
export const X_HANDLE = '@frameXTV';
export const DISCORD_URL = 'https://discord.gg/vPCHZ6PgRX';
export const TOKEN_CA = '6MBf1XdZNSAaDKcxxbnCAngRUxBmwbHS5Ybe2rLRpump';
export const TOKEN_SHORT = '6MBf...pump';
export const TOKEN_URL = `https://pump.fun/coin/${TOKEN_CA}`;

/** Support addresses shown in the donation modal. */
export const SOLANA_ADDRESS = '6MBf1XdZNSAaDKcxxbnCAngRUxBmwbHS5Ybe2rLRpump';
export const BITCOIN_ADDRESS = 'bc1qframextvsupport000000000000000000000';

/** The companion mobile app, downloaded straight from GitHub releases. */
export const APP_RELEASES_URL = 'https://github.com/King-Fisher000/netflix-pro/releases';
export const APP_DOWNLOAD_URL = `${APP_RELEASES_URL}/download/android-apk-fix/android-sdk-setup-tools/app-debug.apk`;

/** Support address shown in the footer / profile. */
export const SUPPORT_EMAIL = 'support@framextv.xyz';

/** Document title for a route. */
export function pageTitle(suffix?: string): string {
  return suffix ? `${suffix} — ${SITE_NAME}` : SITE_NAME;
}
