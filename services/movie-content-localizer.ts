import 'server-only';
import { cache } from 'react';
import { createHash } from 'crypto';

/**
 * Resolve a title's synopsis in the active locale.
 *
 * The provider supplies English synopses. For a Vietnamese page that is the
 * wrong language, so it needs translating — but translation is the one part
 * of this app that cannot be keyless: a machine-translation call needs a
 * provider and a key. So it is OPTIONAL by design.
 *
 *  - `GROQ_API_KEY` set  → English synopses are translated to Vietnamese,
 *                          memoized in-process for the life of the server.
 *  - not set (default)   → the English synopsis is shown as-is.
 *
 * Nothing else in the app depends on translation, and the fallback is the
 * source text rather than an error, so a keyless deploy renders every page.
 * The earlier design cached translations in Firestore; that is gone with the
 * rest of Firebase, which means a cold server retranslates — acceptable, and
 * the reason the in-process cache exists.
 */

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_MAX = 500;

interface CacheEntry {
  content: string;
  sourceHash: string;
  at: number;
}

/** In-process memo, keyed `${movieId}:${locale}`. */
const memo = new Map<string, CacheEntry>();

/**
 * Short digest of the source text, so a rewritten synopsis does not keep
 * serving the old translation. 16 hex chars is ample: a collision would reuse
 * one title's translation for a rewrite of the same title.
 */
function hashSource(content: string): string {
  return createHash('sha1').update(content).digest('hex').slice(0, 16);
}

function readMemo(key: string, sourceHash: string): string | null {
  const entry = memo.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS || entry.sourceHash !== sourceHash) {
    memo.delete(key);
    return null;
  }
  return entry.content;
}

function writeMemo(key: string, sourceHash: string, content: string): void {
  if (memo.size >= CACHE_MAX) {
    // Oldest-first eviction; Map preserves insertion order.
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, { content, sourceHash, at: Date.now() });
}

async function translate(
  movieId: string,
  content: string,
  locale: string
): Promise<string> {
  // Imported lazily so a build with no GROQ_API_KEY never constructs a client.
  const { translateMovieContent } = await import('./groq-translation-service');
  return translateMovieContent(movieId, content, locale, 'en');
}

/**
 * Wrapped in React `cache()` so multiple callers within a single render
 * (e.g. `generateMetadata` AND the page component asking for the same title)
 * share ONE underlying promise.
 */
export const getLocalizedMovieContent = cache(async function getLocalizedMovieContent(
  movieId: string,
  locale: string,
  content: string,
  contentLang: string = 'en'
): Promise<string> {
  if (!movieId || !content) return content;
  if (contentLang === locale) return content;

  const key = `${movieId}:${locale}`;
  const sourceHash = hashSource(content);

  const cached = readMemo(key, sourceHash);
  if (cached) return cached;

  try {
    const translated = await translate(movieId, content, locale);
    writeMemo(key, sourceHash, translated);
    return translated;
  } catch (err) {
    // No key, quota exhausted, provider down — show the source text. A
    // synopsis in the wrong language is a much smaller problem than a page
    // that won't render.
    console.warn(
      `[movie-content-localizer] ${movieId}/${locale} left untranslated:`,
      err instanceof Error ? err.message : err
    );
    return content;
  }
});

// ============================================================================
// BATCH LOCALIZATION
// ============================================================================

export interface BatchLocalizeItem {
  movieId: string;
  content: string;
  /** Language `content` is in. Defaults to English. */
  contentLang?: string;
}

/**
 * Localize many synopses at once, minimizing provider calls.
 *
 * Memo hits are used as-is; everything else goes to the provider in ONE
 * batched prompt. Any failure yields the source text per item, so the caller
 * always gets a complete map.
 */
export async function localizeMovieContentsBatch(
  items: BatchLocalizeItem[],
  locale: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (items.length === 0) return result;

  const pending: BatchLocalizeItem[] = [];

  for (const item of items) {
    const sourceLang = item.contentLang ?? 'en';
    if (!item.movieId || !item.content || sourceLang === locale) {
      result.set(item.movieId, item.content);
      continue;
    }
    const cached = readMemo(`${item.movieId}:${locale}`, hashSource(item.content));
    if (cached) {
      result.set(item.movieId, cached);
      continue;
    }
    pending.push(item);
  }

  if (pending.length === 0) return result;

  try {
    const { translateMovieContentsBatch } = await import('./groq-translation-service');
    const translated = await translateMovieContentsBatch(
      pending.map((it) => ({ id: it.movieId, content: it.content })),
      locale,
      pending[0].contentLang ?? 'en'
    );
    for (const item of pending) {
      const value = translated.get(item.movieId);
      if (value) {
        result.set(item.movieId, value);
        writeMemo(`${item.movieId}:${locale}`, hashSource(item.content), value);
      } else {
        result.set(item.movieId, item.content);
      }
    }
  } catch (err) {
    console.warn(
      '[movie-content-localizer] batch translation unavailable:',
      err instanceof Error ? err.message : err
    );
    pending.forEach((it) => {
      if (!result.has(it.movieId)) result.set(it.movieId, it.content);
    });
  }

  return result;
}
