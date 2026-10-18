import { Link } from 'i18n/routing';
import Wordmark from '../commons/wordmark';
import { IoSearch } from 'react-icons/io5';
import SubType from './sub-type';
import SubCountries from './sub-countries';
import { useSelector } from 'react-redux';
import AccountProfileIcon from '../account/account-profile-icon';
import { useEffect, useState } from 'react';
import { usePathname } from 'i18n/routing';
import PrefetchLink from '../commons/prefetch-link';
import Notification from '../notification';
import { INotificationDropdownState } from 'types/notification';
import { useTranslations } from 'next-intl';

export default function HeaderDefault({
  isShowFixedHeader,
  notificationDropdownState,
  setNotificationDropdownState,
}: {
  isShowFixedHeader: boolean;
  notificationDropdownState: INotificationDropdownState;
  setNotificationDropdownState: React.Dispatch<React.SetStateAction<INotificationDropdownState>>;
}) {
  const t = useTranslations('header.menu');
  const user = useSelector((state: any) => state.auth.user);
  const [authenticatedUser, setAuthenticatedUser] = useState<object | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const pathname = usePathname();

  useEffect(() => {
    setAuthenticatedUser(user);
    setLoading(false);
  }, [user]);

  return (
    <header className="absolute top-0 left-0 right-0 z-20">
      <div className="header-container flex items-center justify-between container-wrapper">
        <Wordmark />
        <ul className="flex flex-grow justify-center items-center font-semibold text-lg">
          <li className="px-8">
            <PrefetchLink
              kind="format"
              slug="phim-le"
              className={`hover:text-custome-red ${
                pathname === '/movies/format/phim-le' && 'text-custome-red'
              }`}
              href="/movies/format/phim-le"
            >
              {t('singleMovies')}
            </PrefetchLink>
          </li>
          <li className="px-8">
            <PrefetchLink
              kind="format"
              slug="phim-bo"
              className={`hover:text-custome-red ${
                pathname === '/movies/format/phim-bo' && 'text-custome-red'
              }`}
              href="/movies/format/phim-bo"
            >
              {t('tvSeries')}
            </PrefetchLink>
          </li>
          <li className="px-8">
            <PrefetchLink
              kind="format"
              slug="hoat-hinh"
              className={`hover:text-custome-red ${
                pathname === '/movies/format/hoat-hinh' && 'text-custome-red'
              }`}
              href="/movies/format/hoat-hinh"
            >
              {t('cartoons')}
            </PrefetchLink>
          </li>
          <li className="px-8">
            <PrefetchLink
              kind="format"
              slug="tv-shows"
              className={`hover:text-custome-red ${
                pathname === '/movies/format/tv-shows' && 'text-custome-red'
              }`}
              href="/movies/format/tv-shows"
            >
              {t('tvShows')}
            </PrefetchLink>
          </li>
          <li className={`px-8 relative ${!isShowFixedHeader && 'group'}`}>
            <p className="leading-[3.62rem] hover:text-custome-red cursor-pointer">{t('categories')}</p>
            <SubType />
          </li>
          <li className={`px-8 relative ${!isShowFixedHeader && 'group'}`}>
            <p className="leading-[3.62rem] hover:text-custome-red cursor-pointer">{t('countries')}</p>
            <SubCountries />
          </li>
        </ul>
        <div className="flex gap-x-3 items-center justify-end min-w-[10rem] h-[3.62rem]">
          {/* Language is chosen automatically from the visitor's location — see middleware.ts. */}
          <Link className="cursor-pointer hover:text-custome-red" href="/search">
            <IoSearch size={25} />
          </Link>
          {authenticatedUser && (
            <AccountProfileIcon authenticatedUser={authenticatedUser} isOnFixedHeader={false} />
          )}
          <div className={`relative h-full flex items-center`}>
            {!loading && authenticatedUser && (
              <Notification
                isOnFixedHeader={false}
                notificationDropdownState={notificationDropdownState}
                setNotificationDropdownState={setNotificationDropdownState}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
