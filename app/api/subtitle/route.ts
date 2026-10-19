import { NextRequest, NextResponse } from 'next/server';
import { toVtt } from 'lib/subtitles';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Subtitle fetch + convert.
 *
 * Two problems this solves, both of which silently produce no subtitles:
 *
 *  - **CORS.** The catalogue's subtitle files are served from arbitrary
 *    third-party hosts with no `access-control-allow-origin`, so a `<track>`
 *    pointing straight at one is refused by the browser. Going through our own
 *    origin makes the track same-origin and the refusal never happens.
 *  - **Format.** The files are usually SubRip. `<track>` only renders WebVTT,
 *    and an SRT file fails silently — no cue, no error.
 *
 * Only http(s) URLs are fetched, and private/loopback targets are refused, so
 * this cannot be pointed at an internal service. It is a read-only proxy: no
 * credentials, no request body, nothing cached beyond a short shared window.
 */

const TIMEOUT_MS = 12000;

/** Hosts that must never be reachable through here. */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'))
    return true;
  // IPv4 loopback / private / link-local ranges.
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127 || a === 0 || a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('url');
  if (!target) {
    return NextResponse.json({ message: 'missing url' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ message: 'invalid url' }, { status: 400 });
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return NextResponse.json({ message: 'unsupported scheme' }, { status: 400 });
  }
  if (isPrivateHost(parsed.hostname)) {
    return NextResponse.json({ message: 'host not allowed' }, { status: 403 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      // Some hosts gate on a browser-ish UA; a plain fetch UA gets a 403.
      headers: {
        accept: 'text/plain, */*',
        'user-agent': 'Mozilla/5.0 (compatible; subtitle-fetch)',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ message: 'upstream error' }, { status: 502 });
    }

    const text = await res.text();
    return new NextResponse(toVtt(text), {
      status: 200,
      headers: {
        'content-type': 'text/vtt; charset=utf-8',
        'cache-control': 'public, max-age=3600',
        'access-control-allow-origin': '*',
      },
    });
  } catch {
    return NextResponse.json({ message: 'subtitle fetch failed' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
