'use client';

import { Link, usePathname } from 'i18n/routing';
import { useTranslations } from 'next-intl';
import { IoHome, IoHomeOutline, IoFilm, IoTv, IoCodeSlash } from 'react-icons/io5';
import { SiCrunchyroll } from 'react-icons/si';
import type { IconType } from 'react-icons';
import SubType from './sub-type';
import SubCountries from './sub-countries';

interface NavItem {
  key: string;
  href: string;
  Icon: IconType;
  /** Extra prefixes that should light the item up (e.g. a detail page). */
  match?: string[];
}

/**
 * The header's primary links, in the upstream site's order: Home, Movies, TV,
 * Anime, API. The API entry is the one the owner asked to surface in the nav —
 * it points at the in-app service landing page (`/[locale]/api`), not at a
 * third-party doc site.
 */
const ITEMS: NavItem[] = [
  { key: 'home', href: '/', Icon: IoHome },
  { key: 'singleMovies', href: '/movies/format/phim-le', Icon: IoFilm },
  { key: 'tvSeries', href: '/movies/format/phim-bo', Icon: IoTv, match: ['/movies/watch'] },
  { key: 'anime', href: '/anime', Icon: SiCrunchyroll },
  { key: 'api', href: '/api', Icon: IoCodeSlash },
];

/**
 * The upstream header treatment: a single pill per link, the active one filled
 * white with black text and the rest muted zinc that brightens on hover. Shared
 * by the desktop bar and the fixed bar so the two cannot drift.
 *
 * `leading` carries the Genres / Countries dropdowns, which are two more pills
 * with the submenu mounted underneath.
 */
export default function HeaderNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('header.menu');
  const pathname = usePathname();

  const isActive = (item: NavItem) => {
    if (item.href === '/') return pathname === '/';
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
    return (item.match ?? []).some((p) => pathname.startsWith(p));
  };

  const pill = (active: boolean) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
      active
        ? 'bg-content-main font-bold text-surface-primary shadow-sm'
        : 'text-content-muted hover:bg-surface-secondary/80 hover:text-content-main'
    }`;

  return (
    <nav className="flex items-center gap-1">
      {ITEMS.map((item) => {
        const active = isActive(item);
        const Icon = item.Icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={pill(active)}
          >
            <Icon className={`h-3.5 w-3.5 ${active ? 'text-surface-primary' : 'text-content-muted'}`} />
            <span>{t(item.key)}</span>
          </Link>
        );
      })}

      {/* Genres and Countries keep their hover dropdowns; they are dropdowns,
          not destinations, so they render as pills with a panel below. */}
      <div className="group relative">
        <button type="button" className={pill(false)}>
          {t('categories')}
        </button>
        <SubType />
      </div>
      <div className="group relative">
        <button type="button" className={pill(false)}>
          {t('countries')}
        </button>
        <SubCountries />
      </div>
    </nav>
  );
}
