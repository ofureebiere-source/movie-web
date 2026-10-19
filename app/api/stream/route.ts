import { NextRequest, NextResponse } from 'next/server';

/**
 * Playback resolver.
 *
 * Every episode's `link_m3u8` points here rather than straight at the
 * catalogue's stream endpoint, and the reason is the same one the whole fetch
 * layer exists: the catalogue's playlist URLs are token-bound and short-lived.
 * Baking one into a page means it has usually expired by the time somebody
 * presses play.
 *
 * So the browser asks us at play time, we ask the catalogue, and we hand back
 * the fresh playlist URL. The request is a plain GET with no credentials —
 * there is nothing secret in the hop.
 *
 * Edge runtime, for the same reason `app/api/catalog` is: the catalogue is
 * behind Cloudflare, which answers the Node serverless pool with a 403
 * challenge but does not challenge the Edge IP pool. On the Node runtime this
 * route answered 502 in production within a quarter-second while working
 * perfectly in local development — the trap AGENTS.md warns about. It is the
 * visitor's browser that reads the catalogue first (see `useResolvedStream`);
 * this route is the fallback for when something on their side blocks it.
 *
 * The response is `no-store` because the playlist it points at expires.
 */

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const API_BASE = (
  process.env.NEXT_PUBLIC_CATALOG_API_BASE ??
  process.env.CATALOG_API_BASE ??
  'https://api.framextv.tech'
).replace(/\/+$/, '');

/**
 * The film aggregation path answers in 16-22s when it has nothing to offer, so
 * this has to outlast it or every film would abort before the catalogue had
 * said either way. The anime path answers in under a second.
 */
const TIMEOUT_MS = 25000;

interface StreamSource {
  url: string;
  quality?: string;
  type?: string;
  server?: string;
}

interface StreamResponse {
  success?: boolean;
  sources?: StreamSource[];
  error?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type') ?? 'movie';
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');
  const provider = searchParams.get('provider');

  if (!id) {
    return NextResponse.json({ message: 'missing id' }, { status: 400 });
  }

  const path = type === 'anime' ? '/anime/api/stream' : '/api/stream';
  const upstream = new URL(`${API_BASE}${path}`);
  upstream.searchParams.set('id', id);
  upstream.searchParams.set('type', type);
  if (season) upstream.searchParams.set('season', season);
  if (episode) upstream.searchParams.set('episode', episode);
  // The viewer's server choice, when they made one. Absent, the aggregator
  // picks for itself — which is what every request did before this existed.
  if (provider) upstream.searchParams.set('provider', provider);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(upstream, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ message: 'stream lookup failed' }, { status: 502 });
    }

    const body = (await res.json()) as StreamResponse;
    const sources = (body.sources ?? []).filter((s) => s?.url);

    if (!sources.length) {
      // A title with no working provider is a 404 to the player, not a 500:
      // the watch page turns it into the "nothing to play" notice.
      return NextResponse.json(
        { message: body.error ?? 'no playable source' },
        { status: 404, headers: { 'cache-control': 'no-store' } }
      );
    }

    // Prefer the highest-bitrate entry; hls.js plays m3u8 and also handles a
    // direct mp4, so either type works. Sorted so 1080p wins over 480p.
    const ranked = [...sources].sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));
    const best = ranked[0];

    return NextResponse.json(
      { url: absolutize(best.url), quality: best.quality ?? null, type: best.type ?? null },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch {
    return NextResponse.json({ message: 'stream lookup failed' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The film and series endpoints return absolute source URLs, but the anime
 * endpoint returns its proxy path relative (`/anime/api/proxy?url=…`). A
 * relative URL handed to the browser resolves against OUR origin, so the
 * player would request a path this app does not serve. Rebase it on the
 * catalogue.
 */
function absolutize(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** "1080p" → 1080, "720p" → 720, unknown → 0. */
function qualityRank(quality: string | undefined): number {
  const match = /(\d{3,4})/.exec(quality ?? '');
  return match ? Number(match[1]) : 0;
}
