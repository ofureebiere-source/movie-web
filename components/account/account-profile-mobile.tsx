'use client';

import { useState } from 'react';
import { Link } from 'i18n/routing';
import AccountDefaultImg from '../../public/account-default-img.jpg';
import Image from 'next/image';
import { IoChevronDown, IoChevronUp, IoPerson, IoBookmark, IoTime } from 'react-icons/io5';
import { useTranslations } from 'next-intl';
import { SITE_NAME } from 'constants/brand';

interface AccountProfileMobileProps {
  authenticatedUser: any;
  onCloseMenu: () => void;
}

/**
 * The account drawer on small screens.
 *
 * Same rule as the desktop dropdown: the viewer's saved things are here, the
 * device identity is not. See `account-profile-dropdown.tsx` for why.
 */
export default function AccountProfileMobile({
  authenticatedUser,
  onCloseMenu,
}: AccountProfileMobileProps) {
  const t = useTranslations('accountMenu');
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="pt-4">
      {/* User Profile Header */}
      <div
        className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary/50 cursor-pointer hover:bg-surface-chip transition-colors"
        onClick={toggleExpanded}
      >
        <div className="flex items-center space-x-3">
          <Image
            src={authenticatedUser.photo || AccountDefaultImg}
            alt="User Profile"
            className="rounded-full border-2 border-line"
            width={40}
            height={40}
          />
          <div className="flex-1 min-w-0">
            <p className="text-content-main font-medium text-sm truncate">
              {authenticatedUser.name || SITE_NAME}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <IoChevronUp className="text-content-muted" size={20} />
        ) : (
          <IoChevronDown className="text-content-muted" size={20} />
        )}
      </div>

      {/* Expanded Menu Items */}
      {isExpanded && (
        <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {/* Collection Link */}
          <Link
            href="/movies/collection"
            onClick={onCloseMenu}
            className="flex items-center space-x-3 p-3 rounded-lg text-content-soft hover:text-content-main hover:bg-surface-chip transition-colors"
          >
            <IoBookmark size={18} />
            <span className="text-sm font-medium">{t('collection')}</span>
          </Link>

          {/* Recent Movies Link */}
          <Link
            href="/movies/recent"
            onClick={onCloseMenu}
            className="flex items-center space-x-3 p-3 rounded-lg text-content-soft hover:text-content-main hover:bg-surface-chip transition-colors"
          >
            <IoTime size={18} />
            <span className="text-sm font-medium">{t('recent')}</span>
          </Link>

          {/* Profile Link */}
          <Link
            href="/profile"
            onClick={onCloseMenu}
            className="flex items-center space-x-3 p-3 rounded-lg text-content-soft hover:text-content-main hover:bg-surface-chip transition-colors"
          >
            <IoPerson size={18} />
            <span className="text-sm font-medium">{t('profile')}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
