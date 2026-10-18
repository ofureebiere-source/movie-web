import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Temporary diagnostic: reports what the catalogue host returns when called
 * from the Vercel runtime. Removed once the outbound call is confirmed.
 */
export async function GET() {
  const base = (process.env.CATALOG_API_BASE ?? 'https://api.framextv.tech').replace(/\/+$/, '');
  const url = `${base}/api/discover?type=movie&page=1`;
  const out: Record<string, unknown> = { base, url, node: process.version };

  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    out.status = res.status;
    out.contentType = res.headers.get('content-type');
    out.server = res.headers.get('server');
    out.cfRay = res.headers.get('cf-ray');
    const text = await res.text();
    out.ms = Date.now() - started;
    out.bodyPrefix = text.slice(0, 400);
    out.bodyLength = text.length;
  } catch (err) {
    out.ms = Date.now() - started;
    out.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    out.cause = err instanceof Error && err.cause ? String(err.cause) : undefined;
  }
  return NextResponse.json(out);
}
