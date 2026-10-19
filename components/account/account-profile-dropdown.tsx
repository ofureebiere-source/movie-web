'use client';

import { useEffect, useRef } from 'react';
import { Link } from 'i18n/routing';
import { useDropdown } from '../context/dropdown-context';
import { useTranslations } from 'next-intl';
import { IoBookmark, IoTime, IoPerson } from 'react-icons/io5';

/**
 * The account menu.
 *
 * It shows the viewer's own saved things and nothing about how the app
 * identifies them. The device is registered silently by `lib/device.ts` so the
 * recommendation engine and notifications have a stable subject; surfacing the
 * id, the device name, or a "forget this device" action was noise, and the id
 * in particular read as something the viewer had signed up for when they had
 * not.
 */
export default function AccountProfileDropdown({ authenticatedUser }: { authenticatedUser: any }) {
  const t = useTranslations('accountMenu');
  const { setAccountDropdownState } = useDropdown();

  const accountDropdownRef = useRef<HTMLDivElement>(null);

  const close = () =>
    setAccountDropdownState({
      isOpenInHeaderDefault: false,
      isOpenInHeaderFixed: false,
    });

  useEffect(() => {
    const detectCloseAccountDropdown = (e: MouseEvent) => {
      if (
        accountDropdownRef.current !== null &&
        !accountDropdownRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    document.addEventListener('click', detectCloseAccountDropdown);

    return () => document.removeEventListener('click', detectCloseAccountDropdown);
  }, [setAccountDropdownState]);

  return (
    <div
      ref={accountDropdownRef}
      className="absolute bg-surface-primary/95 backdrop-blur-sm border border-line right-0 top-[3.625rem] min-w-[16rem] max-w-[20rem] rounded-xl shadow-2xl overflow-hidden z-50"
    >
      {/* Menu Items */}
      <div className="py-2">
        {/* Collection Link */}
        <Link
          href="/movies/collection"
          className="flex items-center space-x-3 px-4 py-3 text-content-soft hover:text-content-main hover:bg-surface-chip transition-colors"
          onClick={close}
        >
          <IoBookmark size={18} />
          <span className="text-sm font-medium">{t('collection')}</span>
        </Link>

        {/* Recent Movies Link */}
        <Link
          href="/movies/recent"
          className="flex items-center space-x-3 px-4 py-3 text-content-soft hover:text-content-main hover:bg-surface-chip transition-colors"
          onClick={close}
        >
          <IoTime size={18} />
          <span className="text-sm font-medium">{t('recent')}</span>
        </Link>

        {/* Profile Link */}
        <Link
          href="/profile"
          className="flex items-center space-x-3 px-4 py-3 text-content-soft hover:text-content-main hover:bg-surface-chip transition-colors"
          onClick={close}
        >
          <IoPerson size={18} />
          <span className="text-sm font-medium">{t('profile')}</span>
        </Link>
      </div>
    </div>
  );
}
