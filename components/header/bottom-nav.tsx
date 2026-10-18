'use client';

import { Link, usePathname } from 'i18n/routing';
import { useTranslations } from 'next-intl';
import {
  IoHome,
  IoHomeOutline,
  IoSearch,
  IoSearchOutline,
  IoPerson,
  IoPersonOutline,
} from 'react-icons/io5';
import { SiCrunchyroll } from 'react-icons/si';
import type { IconType } from 'react-icons';

interface Tab {
  key: 'home' | 'search' | 'anime' | 'profile';
  href: string;
  Icon: IconType;
  IconActive: IconType;
}

const TABS: Tab[] = [
  { key: 'home', href: '/', Icon: IoHomeOutline, IconActive: IoHome },
  { key: 'search', href: '/search', Icon: IoSearchOutline, IconActive: IoSearch },
  // Anime replaces My List: the list is a saved-items view a viewer dips into,
  // while anime is a whole catalogue to browse, and a tab is for the latter.
  // My List moved into the hamburger drawer, which is where the saved view
  // belongs now.
  { key: 'anime', href: '/anime', Icon: SiCrunchyroll, IconActive: SiCrunchyroll },
  { key: 'profile', href: '/profile', Icon: IoPersonOutline, IconActive: IoPerson },
];

/**
 * Mobile-only bottom tab bar (the primary nav pattern of every major streaming
 * app). z-30 sits above page content but below the hamburger drawer (z-40) so
 * the drawer covers it when open.
 *
 * No tab is gated any more: the device registers itself on first load, so
 * "my list" and the profile always have an account behind them.
 */
export default function BottomNav() {
  const t = useTranslations('bottomNav');
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-white/10 bg-black/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          const Icon = active ? tab.IconActive : tab.Icon;
          return (
            <li key={tab.key} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors ${
                  active ? 'text-white' : 'text-gray-500'
                }`}
              >
                <Icon size={22} />
                <span>{t(tab.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
