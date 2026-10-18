import { Link } from 'i18n/routing';
import { SITE_NAME, WORDMARK_LEAD, WORDMARK_ACCENT } from 'constants/brand';

/**
 * The site's wordmark.
 *
 * This replaces an upstream logo image that spelled out the old project name.
 * Text rather than a picture on purpose: it can be read by screen readers and
 * search engines, it scales, and there is no asset to re-cut when the name
 * changes.
 *
 * The name itself lives in `constants/brand.ts` so the mark, the footer, the
 * brand intro and the page titles cannot drift apart.
 *
 * `compact` is for the mobile header, where horizontal room is tight.
 */
export default function Wordmark({ compact = false, onClick }: { compact?: boolean; onClick?: () => void }) {
  return (
    <Link href="/" className="block shrink-0" aria-label={`${SITE_NAME} — home`} onClick={onClick}>
      <span
        className={`font-extrabold tracking-tight text-white leading-none select-none ${
          compact ? 'text-xl' : 'text-2xl'
        }`}
      >
        {WORDMARK_LEAD}
        <span className="text-custome-red"> {WORDMARK_ACCENT}</span>
      </span>
    </Link>
  );
}
