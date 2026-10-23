import { APP_RELEASE_TAG, APP_RELEASES_URL } from '@/lib/brand';

/**
 * Where the companion mobile app is published.
 *
 * Downloads are served straight from GitHub Releases — no third-party host, no
 * mirror. The mobile repo's workflow uploads a signed Android App Bundle to the
 * rolling `android-latest` tag as `netflix-pro-<version>.aab`, so the asset name
 * carries the version and a hardcoded link goes stale the moment the version is
 * bumped.
 *
 * A bundle is not installable on a device: Play regenerates a split APK per
 * device from it. So this resolves the bundle for reference, but the release
 * page is what a visitor can act on, and that is what the banner links to.
 *
 * This mirrors the resolver inside the mobile app (`src/services/releases/`),
 * so the site and the app agree on one tag and one naming scheme. The API is
 * asked for the real asset first and the deterministic URL is the fallback.
 */

const RELEASE_API_URL = `https://api.github.com/repos/ofureebiere-source/netflix-pro/releases/tags/${APP_RELEASE_TAG}`;

export interface AppDownload {
  /** Direct `.aab` asset URL. A Play upload artifact, not an install link. */
  aabUrl: string;
  /** Human-facing release page, which is where a visitor can actually act. */
  releaseUrl: string;
  /** Version the asset name carries, when it could be read. */
  version: string;
}

/**
 * The version-independent alias the workflow publishes alongside the versioned
 * asset. Unlike a `netflix-pro-<version>.aab` link, this never goes stale when
 * the version is bumped, so it is the fallback when the API cannot be read.
 */
export const STABLE_AAB_URL = `${APP_RELEASES_URL}/download/${APP_RELEASE_TAG}/netflix-pro.aab`;

const FALLBACK: AppDownload = {
  aabUrl: STABLE_AAB_URL,
  releaseUrl: APP_RELEASES_URL,
  version: '',
};

/**
 * Resolve the published bundle, falling back to the stable alias.
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
    // Only bundles. The release used to carry an APK and may still carry one
    // while a rollout is in flight; linking it would offer a file this build no
    // longer produces.
    const assets = (release.assets ?? []).filter((entry) =>
      entry?.name?.toLowerCase().endsWith('.aab')
    );
    // Prefer the versioned asset over the stable alias, so the resolved version
    // is real rather than empty; asset order in the API response is not
    // guaranteed.
    const asset =
      assets.find((entry) => /\d+\.\d+\.\d+/.test(entry?.name ?? '')) ?? assets[0];
    if (!asset?.browser_download_url) return FALLBACK;

    return {
      aabUrl: asset.browser_download_url,
      releaseUrl: APP_RELEASES_URL,
      version: asset.name?.match(/(\d+\.\d+\.\d+)/)?.[1] ?? '',
    };
  } catch {
    return FALLBACK;
  }
}
