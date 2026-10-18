import { Link } from 'i18n/routing';

/**
 * The site's wordmark.
 *
 * This replaces an upstream logo image that spelled out the old project name.
 * Text rather than a picture on purpose: it can be read by screen readers and
 * search engines, it scales, and there is no asset to re-cut when the name
 * changes.
 *
 * `compact` is for the mobile header, where horizontal room is tight.
 */
export default function Wordmark({ compact = false, onClick }: { compact?: boolean; onClick?: () => void }) {
  return (
    <Link href="/" className="block shrink-0" aria-label="Netflix-pro — home" onClick={onClick}>
      <span
        className={`font-extrabold tracking-tight text-white leading-none select-none ${
          compact ? 'text-xl' : 'text-2xl'
        }`}
      >
        Netflix<span className="text-custome-red">-pro</span>
      </span>
    </Link>
  );
}
