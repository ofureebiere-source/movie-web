import { apiBase } from '@/lib/config';

/**
 * Subtitle transport and cue parsing.
 *
 * The reference never hands a subtitle URL straight to `<track src>`: the
 * track hosts answer with `application/x-subrip` (SRT) and no usable
 * cross-origin `<track>` semantics, so the browser silently renders nothing.
 * It instead rewrites the URL through its own proxy and parses the body into
 * cues itself. Both steps are reproduced here.
 */

export interface ParsedCue {
  start: number;
  end: number;
  text: string;
}

/** Hosts whose referer the proxy needs to spoof. */
const REFERERS: Array<{ match: (url: string) => boolean; ref: string }> = [
  { match: (url) => /yifysubtitles|yify/i.test(url), ref: 'https://yifysubtitles.ch/' },
  { match: (url) => /opensubtitles/i.test(url), ref: 'https://www.opensubtitles.org/' },
  { match: (url) => /subscene/i.test(url), ref: 'https://subscene.com/' },
  { match: (url) => /podnapisi/i.test(url), ref: 'https://www.podnapisi.net/' },
  { match: (url) => /addic7ed/i.test(url), ref: 'https://www.addic7ed.com/' },
];

/**
 * Rewrite a subtitle URL into something the browser can actually read.
 *
 * Already-proxied, blob and data URLs pass through untouched, as does anything
 * served by the worker origin the streams already come from.
 */
export function subtitleUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:') || url.includes('workers.dev')) return url;

  if (
    url.startsWith('/api/proxy') ||
    url.includes('/api/proxy') ||
    url.startsWith('/api/subtitles/proxy') ||
    url.includes('/api/subtitles/proxy')
  ) {
    const base = apiBase() || (typeof window !== 'undefined' ? window.location.origin : '');
    if (url.startsWith('http')) return url;
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  const known = REFERERS.find((entry) => entry.match(url));
  const ref = known ? `&ref=${encodeURIComponent(known.ref)}` : '';
  return `${apiBase()}/api/subtitles/proxy?url=${encodeURIComponent(url)}${ref}`;
}

/**
 * Parse a SubRip or WebVTT body into cues.
 *
 * Handles both comma and dot millisecond separators, CRLF, BOM-ish leading
 * blank lines, multi-line cue text, SRT index lines and inline markup.
 */
export function parseSubtitles(body: string): ParsedCue[] {
  const cues: ParsedCue[] = [];
  const lines = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const toSeconds = (value: string): number => {
    const parts = value.trim().replace(',', '.').split(':');
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    }
    if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    return 0;
  };

  const timing = /^([\d:.,-]+)\s*-->\s*([\d:.,-]+)/;
  let index = 0;

  if (lines[0]?.trim().startsWith('WEBVTT')) {
    index += 1;
    while (index < lines.length && lines[index]?.trim() !== '') index += 1;
    index += 1;
  }

  while (index < lines.length) {
    while (index < lines.length && (!lines[index]?.trim() || /^\d+$/.test(lines[index].trim()))) index += 1;
    if (index >= lines.length) break;

    const match = lines[index]?.match(timing);
    if (!match) {
      index += 1;
      continue;
    }

    const start = toSeconds(match[1]);
    const end = toSeconds(match[2]);
    index += 1;

    const text: string[] = [];
    while (
      index < lines.length &&
      lines[index]?.trim() !== '' &&
      !timing.test(lines[index]) &&
      !(/^\d+$/.test(lines[index].trim()) && index + 1 < lines.length && timing.test(lines[index + 1]))
    ) {
      text.push(lines[index].trim());
      index += 1;
    }

    const joined = text.join('\n').replace(/<[^>]+>/g, '');
    if (joined && !Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      cues.push({ start, end, text: joined });
    }
  }

  return cues;
}

/** Apply a sync offset (seconds) to every cue. */
export function shiftCues(cues: ParsedCue[], offset: number): ParsedCue[] {
  if (!offset) return cues;
  return cues.map((cue) => ({ ...cue, start: cue.start + offset, end: cue.end + offset }));
}
