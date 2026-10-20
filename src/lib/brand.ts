/**
 * The site's own name, in one place.
 *
 * The wordmark is our own: `Netflix` in white with a `-pro` suffix in red.
 * There is no badge glyph — the reference's square `fX` tile is gone, so the
 * name stands on its own in the header and footer.
 *
 * The companion mobile app is ours and does not exist upstream:
 *
 *   APP_*        the mobile app this site ships, served straight from the
 *                netflix-pro GitHub releases.
 */

export const SITE_NAME = 'Netflix-pro';
/** `Netflix` — rendered in white. */
export const SITE_LEAD = 'Netflix';
/** `-pro` — rendered in red. Empty `SITE_MIDDLE`/`SITE_TAIL` keep older call sites inert. */
export const SITE_SUFFIX = '-pro';
export const SITE_MIDDLE = '';
export const SITE_TAIL = '';

/** Retained as an empty string: the badge tile was removed from the chrome. */
export const BADGE = '';

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
export const APP_RELEASE_TAG = 'android-latest';
/**
 * The version-independent alias the release workflow publishes next to the
 * versioned `netflix-pro-<version>.apk`. It always points at the newest build,
 * so this URL never goes stale when the version is bumped. The install banner
 * asks the release API for the versioned asset first (src/lib/appRelease.ts)
 * and uses this only as the fallback.
 */
export const APP_DOWNLOAD_URL = `${APP_RELEASES_URL}/download/${APP_RELEASE_TAG}/netflix-pro.apk`;

/** Support address shown in the footer / profile. */
export const SUPPORT_EMAIL = 'support@framextv.xyz';

/** Document title for a route. */
export function pageTitle(suffix?: string): string {
  return suffix ? `${suffix} — ${SITE_NAME}` : SITE_NAME;
}
