import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * TEMPORARY diagnostic — removed in the next commit.
 *
 * Decides the anime-catalogue access strategy. The anime endpoints
 * (`/anime/api/*`) send no `access-control-allow-origin`, so the browser
 * cannot read them; the film endpoints do, so they are read client-side. If
 * this runtime can reach the anime endpoints, a server-side proxy fixes it.
 */
async function probe(label: string, url: string) {
  const started = Date.now();
  const out: Record<string, unknown> = { label, url };
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
    out.status = res.status;
    out.contentType = res.headers.get('content-type');
    out.cfRay = res.headers.get('cf-ray');
    const text = await res.text();
    out.ms = Date.now() - started;
    out.len = text.length;
    out.isJson = text.trimStart().startsWith('{');
    if (!out.isJson) out.prefix = text.slice(0, 100);
  } catch (err) {
    out.ms = Date.now() - started;
    out.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
  return out;
}

export async function GET() {
  const base = 'https://api.framextv.tech';
  const results = await Promise.all([
    probe('film-discover', `${base}/api/discover?type=movie&page=1`),
    probe('film-home', `${base}/api/home`),
    probe('anime-discover', `${base}/anime/api/discover?page=1`),
    probe('anime-stream', `${base}/anime/api/stream?id=16498&type=anime&episode=1`),
    probe('film-stream', `${base}/api/stream?id=969681&type=movie`),
  ]);
  return NextResponse.json({ node: process.version, results });
}
