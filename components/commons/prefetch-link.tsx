'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';
import { Link } from 'i18n/routing';
import { prefetchBrowse } from 'lib/catalog-client';
import type { Locale } from 'i18n/routing';

type BrowseKind = 'format' | 'type' | 'country';

/**
 * A browse link that warms its catalogue page on hover or focus.
 *
 * The catalogue is fetched in the visitor's browser (see `lib/catalog-client`),
 * so a navigation would otherwise start with an empty screen and a round trip.
 * Prefetching on intent — hover for a mouse, focus for a keyboard — means the
 * data is usually already in `sessionStorage` by the time the click lands, and
 * the destination paints with its rows rather than a skeleton.
 *
 * The prefetch is fire-and-forget and never blocks the click; a slow or failed
 * warm-up costs nothing, because the destination fetches for itself regardless.
 */
export default function PrefetchLink({
  kind,
  slug,
  href,
  className,
  children,
}: {
  kind: BrowseKind;
  slug: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const locale = useLocale() as Locale;

  const warm = useCallback(() => {
    prefetchBrowse(kind, slug, locale);
  }, [kind, slug, locale]);

  return (
    <Link href={href} className={className} onMouseEnter={warm} onFocus={warm} onTouchStart={warm}>
      {children}
    </Link>
  );
}
