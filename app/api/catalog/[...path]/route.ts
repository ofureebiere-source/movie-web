import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Server-side passthrough to the framextv catalogue.
 *
 * The catalogue is behind Cloudflare, which answers Vercel's Node serverless
 * pool with a 403 bot challenge — verified against every host and every
 * endpoint — but does NOT challenge the Edge runtime's IP pool. The Edge
 * runtime can also read the anime endpoints, which send no
 * `access-control-allow-origin` and are therefore unreadable from the browser
 * whatever origin it is on.
 *
 * So this route is the one place a catalogue read can happen outside the
 * visitor's browser. It is a plain GET passthrough: no credentials, nothing
 * cached beyond a short shared window, and only the paths the app actually
 * uses are allowed through so it cannot be pointed at arbitrary hosts.
 */

const API_BASE = (
  process.env.NEXT_PUBLIC_CATALOG_API_BASE ??
  process.env.CATALOG_API_BASE ??
  'https://api.framextv.tech'
).replace(/\/+$/, '');

/** Prefixes the app calls. Anything else is refused rather than forwarded. */
const ALLOWED_PREFIXES = ['/api/', '/anime/api/'];

const TIMEOUT_MS = 15000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const upstreamPath = `/${(path ?? []).join('/')}`;

  if (!ALLOWED_PREFIXES.some((prefix) => `${upstreamPath}/`.startsWith(prefix))) {
    return NextResponse.json({ message: 'path not allowed' }, { status: 403 });
  }

  const upstream = new URL(`${API_BASE}${upstreamPath}`);
  request.nextUrl.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(upstream, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });

    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/json',
        // The upstream list endpoints are slow and rate-limited; a short
        // shared cache keeps a popular page from re-asking per viewer.
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch {
    return NextResponse.json({ message: 'catalogue lookup failed' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
