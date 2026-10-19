'use client';
import countries from 'data/countries';
import { useLocale } from 'next-intl';
import PrefetchLink from '../commons/prefetch-link';
import { localizedCountry } from 'constants/i18n-mappings';
import type { Locale } from 'i18n/routing';

export default function SubCountries() {
  const locale = useLocale() as Locale;
  return (
    <ul className="text-sm group-hover:flex hidden absolute left-0 top-full mt-1 px-6 py-6 min-w-[50rem] bg-surface-card border border-line rounded-xl shadow-2xl flex-col flex-wrap z-50 gap-x-7 gap-y-4">
      {countries.map((item) => (
        <li key={item.slug} className="text-zinc-300 hover:text-white">
          <PrefetchLink kind="country" slug={item.slug} href={`/movies/country/${item.slug}`}>
            {localizedCountry(item.slug, locale)}
          </PrefetchLink>
        </li>
      ))}
    </ul>
  );
}
