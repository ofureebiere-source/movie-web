'use client';

import { useTranslations } from 'next-intl';
import TrendingSlider, { type TrendingItem } from './trending-slider';

/**
 * Trending row.
 *
 * The items are computed on the server from `public/data/trending.json` and
 * passed in rather than fetched here — the file is static, so a round trip
 * would buy nothing, and building the list server-side keeps the rank
 * numbering and poster filtering in one place.
 */
export default function TrendingSection({ items }: { items: TrendingItem[] }) {
  const t = useTranslations('home.trending');

  if (items.length === 0) return null;

  return (
    <div className="container-wrapper space-y-4">
      <div className="px-4 md:px-0">
        <h2 className="relative inline-block pl-4 text-xl md:text-2xl font-bold tracking-tight">
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 md:h-7 bg-gradient-to-b from-red-500 to-red-700 rounded-full" />
          {t('title')}
        </h2>
      </div>

      <TrendingSlider items={items} />
    </div>
  );
}
