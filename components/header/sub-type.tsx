'use client';
import movieType from 'data/movie-type';
import { useLocale } from 'next-intl';
import PrefetchLink from '../commons/prefetch-link';
import { localizedCategory } from 'constants/i18n-mappings';
import type { Locale } from 'i18n/routing';

export default function SubType() {
  const locale = useLocale() as Locale;
  return (
    <ul className="text-sm group-hover:flex hidden absolute left-0 top-full mt-1 px-6 py-6 min-w-[35rem] bg-surface-card border border-line rounded-xl shadow-2xl flex-col flex-wrap z-50 gap-x-7 gap-y-4">
      {movieType.map((item) => (
        <li key={item.slug} className="text-zinc-300 hover:text-white">
          <PrefetchLink kind="type" slug={item.slug} href={`/movies/type/${item.slug}`}>
            {localizedCategory(item.slug, locale)}
          </PrefetchLink>
        </li>
      ))}
    </ul>
  );
}
