'use client';

import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { removeUser } from '../../redux/slices/user-slice';
import { forgetDevice } from '../../lib/device';
import { Link } from 'i18n/routing';
import { useDropdown } from '../context/dropdown-context';
import { useTranslations } from 'next-intl';
import { IoBookmark, IoTime, IoPerson, IoTrash } from 'react-icons/io5';

export default function AccountProfileDropdown({ authenticatedUser }: { authenticatedUser: any }) {
  const t = useTranslations('accountMenu');
  const { setAccountDropdownState } = useDropdown();
  const dispatch = useDispatch();
  const [isConfirmingForget, setIsConfirmingForget] = useState<boolean>(false);

  const accountDropdownRef = useRef<HTMLDivElement>(null);

  const deviceId: string = authenticatedUser.device?.id ?? authenticatedUser.id ?? '';

  const handleForgetDevice = () => {
    // First press arms the action, the second commits it — a stray click on a
    // dropdown that sits under the cursor should not wipe the watch history.
    if (!isConfirmingForget) {
      setIsConfirmingForget(true);
      return;
    }
    forgetDevice();
    dispatch(removeUser());
    window.location.href = '/';
  };

  useEffect(() => {
    const detectCloseAccountDropdown = (e: MouseEvent) => {
      if (
        accountDropdownRef.current !== null &&
        !accountDropdownRef.current.contains(e.target as Node)
      ) {
        setAccountDropdownState({
          isOpenInHeaderDefault: false,
          isOpenInHeaderFixed: false,
        });
      }
    };

    document.addEventListener('click', detectCloseAccountDropdown);

    return () => document.removeEventListener('click', detectCloseAccountDropdown);
  }, [setAccountDropdownState]);

  return (
    <div
      ref={accountDropdownRef}
      className="absolute bg-black/95 backdrop-blur-sm border border-gray-700 right-0 top-[3.625rem] min-w-[16rem] max-w-[20rem] rounded-xl shadow-2xl overflow-hidden z-50"
    >
        {/* Device Info Header */}
        <div className="px-4 py-4 bg-gradient-to-r from-gray-800/50 to-gray-700/50 border-b border-gray-600">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shrink-0">
              <span className="text-white font-semibold text-sm">
                {authenticatedUser.name?.charAt(0)?.toUpperCase() || 'D'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate" data-private>
                {authenticatedUser.name || 'Thiết bị'}
              </p>
              <p className="text-gray-400 text-xs truncate font-mono" data-private>
                {deviceId.slice(0, 12)}
              </p>
            </div>
          </div>
        </div>

      {/* Menu Items */}
      <div className="py-2">
        {/* Collection Link */}
        <Link
          href="/movies/collection"
          className="flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors"
          onClick={() =>
            setAccountDropdownState({
              isOpenInHeaderDefault: false,
              isOpenInHeaderFixed: false,
            })
          }
        >
          <IoBookmark size={18} />
          <span className="text-sm font-medium">{t('collection')}</span>
        </Link>

        {/* Recent Movies Link */}
        <Link
          href="/movies/recent"
          className="flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors"
          onClick={() =>
            setAccountDropdownState({
              isOpenInHeaderDefault: false,
              isOpenInHeaderFixed: false,
            })
          }
        >
          <IoTime size={18} />
          <span className="text-sm font-medium">{t('recent')}</span>
        </Link>

        {/* Profile Link */}
        <Link
          href="/profile"
          className="flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors"
          onClick={() =>
            setAccountDropdownState({
              isOpenInHeaderDefault: false,
              isOpenInHeaderFixed: false,
            })
          }
        >
          <IoPerson size={18} />
          <span className="text-sm font-medium">{t('profile')}</span>
        </Link>

        {/* Divider */}
        <div className="border-t border-gray-700 my-2"></div>

        {/* Forget device */}
        <button
          onClick={handleForgetDevice}
          className="flex items-center space-x-3 px-4 py-3 w-full text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors"
        >
          <IoTrash size={18} />
          <span className="text-sm font-medium">
            {isConfirmingForget ? t('confirmForget') : t('forgetDevice')}
          </span>
        </button>
      </div>
    </div>
  );
}
