/**
 * Subtitle format helpers.
 *
 * The catalogue hands back subtitle files as SRT (occasionally already VTT).
 * `<track>` only accepts WebVTT, so anything SRT has to be converted before it
 * reaches the element — an SRT file pointed at a `track` renders nothing at
 * all, silently, which is how "the player has no subtitles" usually presents.
 */

/** True when the payload is already WebVTT. */
export function isVtt(text: string): boolean {
  return /^\uFEFF?\s*WEBVTT/.test(text);
}

/**
 * Convert SubRip to WebVTT.
 *
 * The two formats differ in three ways that matter: VTT needs a `WEBVTT`
 * header, it uses `.` as the millisecond separator (SRT uses `,`), and it
 * wants a blank line between cues. Cue indices may be kept — VTT allows them.
 */
export function srtToVtt(srt: string): string {
  const body = srt
    .replace(/^\uFEFF/, '')
    // 00:00:01,000 --> 00:00:04,000
    .replace(
      /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g,
      '$1.$2 --> $3.$4'
    )
    // A single-digit hour is legal in SRT but not in VTT.
    .replace(/^(\d):(\d{2}:\d{2}[.,]\d{3})/gm, '0$1:$2')
    .replace(/\r\n/g, '\n');

  return `WEBVTT\n\n${body.trim()}\n`;
}

/** Convert to WebVTT unless it already is. */
export function toVtt(text: string): string {
  return isVtt(text) ? text : srtToVtt(text);
}

/**
 * A readable label for a subtitle track.
 *
 * The catalogue's labels are inconsistent — sometimes a language name,
 * sometimes a filename, sometimes an ISO code — so this prefers the explicit
 * language field and falls back to the last meaningful token of the URL. The
 * `Subtitles • ` prefix the aggregator writes onto every label is stripped:
 * the panel already says these are subtitles, and the prefix pushes the part
 * that actually differs out of view in a narrow menu.
 */
export function subtitleLabel(input: {
  label?: string;
  language?: string;
  lang?: string;
  url: string;
}): string {
  const clean = (value?: string) =>
    value?.replace(/^\s*subtitles?\s*[•·\-–—:]\s*/i, '').trim() ?? '';

  const explicit = clean(input.label) || clean(input.language) || input.lang?.trim();
  if (explicit) return explicit;

  const file = input.url.split('?')[0].split('/').pop() ?? '';
  const base = file.replace(/\.(srt|vtt|ass|ssa)$/i, '').replace(/[._-]+/g, ' ').trim();
  return base || 'Subtitle';
}

/**
 * Best-effort BCP-47 tag for a track, for `track srcLang` and for picking the
 * default track. The catalogue's own `lang` field is used verbatim when it is
 * present and looks like a tag (it carries regional variants such as `zh-tw`
 * and `pt-br` that a name-based guess would flatten); otherwise the language
 * name is matched.
 */
export function subtitleLang(input: { language?: string; lang?: string; label?: string }): string {
  const tag = input.lang?.trim().toLowerCase();
  if (tag && /^[a-z]{2,3}(-[a-z0-9]{2,4})?$/.test(tag)) return tag;

  const raw = (input.language || input.label || '').toLowerCase();
  if (/vietnamese|tiếng việt|^vi$/.test(raw)) return 'vi';
  if (/english|^en$/.test(raw)) return 'en';
  if (/chinese|mandarin|cantonese|trung/.test(raw)) return 'zh';
  if (/korean|hàn/.test(raw)) return 'ko';
  if (/japanese|nhật/.test(raw)) return 'ja';
  if (/thai|thái/.test(raw)) return 'th';
  if (/indonesian|tiếng indonesia/.test(raw)) return 'id';
  if (/french|français|pháp/.test(raw)) return 'fr';
  if (/spanish|español|tây ban nha/.test(raw)) return 'es';
  if (/portuguese|português/.test(raw)) return 'pt';
  if (/german|deutsch|đức/.test(raw)) return 'de';
  if (/russian|русский|nga/.test(raw)) return 'ru';
  if (/arabic|العربية|ả rập/.test(raw)) return 'ar';
  return tag || 'und';
}
