import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * TEMPORARY diagnostic — removed in the next commit.
 *
 * The Node.js serverless runtime is refused by the catalogue's Cloudflare
 * edge (403 challenge, every host). This checks whether the Edge runtime's
 * different IP pool and header set fare any better.
 */
const BROWSER_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
  referer: 'https://framextv.xyz/',
  origin: 'https://framextv.xyz',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
};

async function probe(label: string, url: string, headers?: Record<string, string>) {
  const started = Date.now();
  const out: Record<string, unknown> = { label, url, edge: true };
  try {
    const res = await fetch(url, { headers, cache: 'no-store' });
    out.status = res.status;
    out.contentType = res.headers.get('content-type');
    const text = await res.text();
    out.ms = Date.now() - started;
    out.len = text.length;
    out.isJson = text.trimStart().startsWith('{');
    if (!out.isJson) out.prefix = text.slice(0, 80);
  } catch (err) {
    out.ms = Date.now() - started;
    out.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
  return out;
}

export async function GET() {
  const base = 'https://api.framextv.tech';
  const results = await Promise.all([
    probe('edge-plain-film', `${base}/api/home`),
    probe('edge-browser-film', `${base}/api/home`, BROWSER_HEADERS),
    probe('edge-plain-anime', `${base}/anime/api/discover?page=1`),
    probe('edge-browser-anime', `${base}/anime/api/discover?page=1`, BROWSER_HEADERS),
  ]);
  return NextResponse.json({ runtime: 'edge', results });
}
