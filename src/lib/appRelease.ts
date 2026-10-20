import { APP_RELEASE_TAG, APP_RELEASES_URL, APP_VERSION } from '@/lib/brand';

/**
 * Where the companion mobile app is downloaded from.
 *
 * Downloads are served straight from GitHub Releases — no third-party host, no
 * mirror. The mobile repo's workflow uploads a signed APK to the rolling
 * `android-latest` tag as `netflix-pro-<version>.apk`, so the asset name
 * carries the version and a hardcoded link goes stale the moment the version
 * is bumped.
 *
 * This mirrors the resolver inside the mobile app (`src/services/releases/`),
 * so the site and the app agree on one tag and one naming scheme. The API is
 * asked for the real asset first and the deterministic URL is the fallback.
 */

const RELEASE_API_URL = `https://api.github.com/repos/King-Fisher000/netflix-pro/releases/tags/${APP_RELEASE_TAG}`;

export interface AppDownload {
  /** Direct `.apk` asset URL. */
  apkUrl: string;
  /** Human-facing release page, always reachable. */
  releaseUrl: string;
  /** Version the asset name carries, when it could be read. */
  version: string;
}

/** The deterministic URL for a known version, used when the API is unavailable. */
export function directApkUrl(version: string = APP_VERSION): string {
  return `${APP_RELEASES_URL}/download/${APP_RELEASE_TAG}/netflix-pro-${version}.apk`;
}

const FALLBACK: AppDownload = {
  apkUrl: directApkUrl(),
  releaseUrl: APP_RELEASES_URL,
  version: APP_VERSION,
};

/**
 * Resolve the published APK, falling back to the deterministic URL.
 *
 * Never throws and never rejects: a rate-limited or unreachable API must not
 * turn the install banner into a dead link.
 */
export async function resolveAppDownload(signal?: AbortSignal): Promise<AppDownload> {
  try {
    const response = await fetch(RELEASE_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal,
    });
    if (!response.ok) return FALLBACK;

    const release = (await response.json()) as {
      assets?: { name?: string; browser_download_url?: string }[];
    };
    const asset = (release.assets ?? []).find((entry) =>
      entry?.name?.toLowerCase().endsWith('.apk')
    );
    if (!asset?.browser_download_url) return FALLBACK;

    return {
      apkUrl: asset.browser_download_url,
      releaseUrl: APP_RELEASES_URL,
      version: asset.name?.match(/(\d+\.\d+\.\d+)/)?.[1] ?? APP_VERSION,
    };
  } catch {
    return FALLBACK;
  }
}
