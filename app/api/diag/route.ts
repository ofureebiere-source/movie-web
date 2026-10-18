import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Temporary diagnostic: the catalogue host sits behind Cloudflare and answers
 * Vercel's datacenter IPs with a 403 bot challenge. This probes which header
 * sets and which alternate hosts get through. Removed once a strategy wins.
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
  'sec-fetch-site': 'same-site',
};

async function probe(label: string, url: string, headers?: Record<string, string>) {
  const started = Date.now();
  const out: Record<string, unknown> = { label, url };
  try {
    const res = await fetch(url, { headers, cache: 'no-store' });
    out.status = res.status;
    out.contentType = res.headers.get('content-type');
    const text = await res.text();
    out.ms = Date.now() - started;
    out.len = text.length;
    out.ok = text.trimStart().startsWith('{');
    if (!out.ok) out.prefix = text.slice(0, 120);
  } catch (err) {
    out.ms = Date.now() - started;
    out.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
  return out;
}

export async function GET() {
  const path = '/api/discover?type=movie&page=1';
  const results = await Promise.all([
    probe('plain', `https://api.framextv.tech${path}`),
    probe('browser-headers', `https://api.framextv.tech${path}`, BROWSER_HEADERS),
    probe('ua-only', `https://api.framextv.tech${path}`, {
      'user-agent': BROWSER_HEADERS['user-agent'],
      accept: 'application/json',
    }),
    probe('host-api.xyz', `https://api.framextv.xyz${path}`, BROWSER_HEADERS),
    probe('host-site', `https://framextv.xyz${path}`, BROWSER_HEADERS),
  ]);
  return NextResponse.json({ node: process.version, results });
}
