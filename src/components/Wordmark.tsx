import { SITE_LEAD, SITE_SUFFIX } from '@/lib/brand';

/**
 * The site wordmark: `Netflix` in white with `-pro` in red.
 *
 * There is no badge tile any more, so this is the one place the name is drawn.
 * The two spans are inline so the wordmark wraps and scales as a single unit.
 */
export default function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight whitespace-nowrap ${className}`}>
      <span className="text-white">{SITE_LEAD}</span>
      <span className="text-rose-500">{SITE_SUFFIX}</span>
    </span>
  );
}
