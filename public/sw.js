/**
 * Netflix-pro Service Worker with Image & Shell Caching
 * =====================================================
 * Versioned app shell caching + Cache-First poster/backdrop caching.
 *
 * Ported 1:1 from the reference's `sw.js`, with the cache namespace renamed to
 * our own brand. The safety rules are the reference's, unchanged:
 *
 * 1. Absolutely NO caching of video streams, HLS manifests, video segments,
 *    subtitles, proxy endpoints, or video players. All playback traffic passes
 *    directly to the network without interception.
 * 2. Only artwork/poster images (TMDB image CDN, AniList media CDN) are cached,
 *    with a bounded LRU cap of 250 entries to protect device storage.
 */

const SHELL_CACHE_NAME = 'netflix-pro-shell-v2';
const IMAGE_CACHE_NAME = 'netflix-pro-images-v1';
const MAX_IMAGE_CACHE_ENTRIES = 250;

const PRECACHE_ASSETS = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (name) =>
                name.startsWith('netflix-pro-') &&
                name !== SHELL_CACHE_NAME &&
                name !== IMAGE_CACHE_NAME
            )
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

/**
 * Trim cache to max items to avoid quota issues
 */
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const toDelete = keys.slice(0, keys.length - maxItems);
      await Promise.all(toDelete.map((key) => cache.delete(key)));
    }
  } catch {
    // Ignore trimming errors
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle standard GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // =========================================================================
  // 1. Poster & Artwork Caching (TMDB and AniList Image CDNs)
  // =========================================================================
  const isPosterImage =
    (url.hostname.includes('image.tmdb.org') ||
      url.hostname.includes('s4.anilist.co') ||
      url.hostname.includes('anilistcdn')) &&
    /\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(url.pathname + url.search);

  if (isPosterImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone());
            // Trim asynchronously
            trimCache(IMAGE_CACHE_NAME, MAX_IMAGE_CACHE_ENTRIES);
          }
          return networkResponse;
        } catch {
          return cachedResponse || new Response('', { status: 504 });
        }
      })
    );
    return;
  }

  // =========================================================================
  // HARD BYPASS: Strictly exclude all API, streaming, and external media requests
  // =========================================================================
  const isExcludedPath =
    url.pathname.startsWith('/api/') ||
    url.pathname === '/api' ||
    url.pathname.startsWith('/anime/api/') ||
    url.pathname === '/anime/api' ||
    url.pathname.includes('/stream') ||
    url.pathname.includes('/proxy') ||
    url.pathname.includes('/subtitles') ||
    url.pathname.includes('.m3u8') ||
    url.pathname.includes('.ts') ||
    url.pathname.includes('.m4s') ||
    url.pathname.includes('.mp4') ||
    /\.(m3u8|ts|m4s|mp4|webm|mkv|vtt|srt)(\?|$)/i.test(url.pathname + url.search) ||
    url.hostname.includes('themoviedb.org') ||
    url.hostname.includes('anilist.co') ||
    url.hostname.includes('strem.io') ||
    url.hostname.includes('stream') ||
    url.hostname.includes('vidsonic') ||
    url.hostname.includes('vidsrc');

  if (isExcludedPath) {
    // Pure network pass-through — zero interception, zero caching
    return;
  }

  // =========================================================================
  // 2. Navigation Requests (HTML document): Network-first with cache fallback
  // =========================================================================
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(SHELL_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('/index.html');
        })
    );
    return;
  }

  // =========================================================================
  // 3. Same-Origin Static Assets (JS chunks, CSS, fonts, SVG/PNG icons)
  // =========================================================================
  if (url.origin === self.location.origin) {
    const isStaticAsset =
      url.pathname.startsWith('/assets/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.woff2');

    if (isStaticAsset) {
      event.respondWith(
        caches.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const copy = networkResponse.clone();
                caches.open(SHELL_CACHE_NAME).then((cache) => cache.put(request, copy));
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          // Stale-While-Revalidate
          return cachedResponse || fetchPromise;
        })
      );
    }
  }
});
