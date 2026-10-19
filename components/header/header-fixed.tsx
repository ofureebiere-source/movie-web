import Wordmark from '../commons/wordmark';
import { IoSearch } from 'react-icons/io5';
import HeaderNav from './header-nav';
import { useSelector } from 'react-redux';
import AccountProfileIcon from '../account/account-profile-icon';
import { useEffect, useState } from 'react';
import Notification from '../notification';
import { INotificationDropdownState } from 'types/notification';
import { Link } from 'i18n/routing';
import { useTranslations } from 'next-intl';

export default function HeaderFixed({
  isShowFixedHeader,
  notificationDropdownState,
  setNotificationDropdownState,
}: {
  isShowFixedHeader: boolean;
  notificationDropdownState: INotificationDropdownState;
  setNotificationDropdownState: React.Dispatch<React.SetStateAction<INotificationDropdownState>>;
}) {
  const t = useTranslations('header');
  const user = useSelector((state: any) => state.auth.user);
  const [authenticatedUser, setAuthenticatedUser] = useState<object | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setAuthenticatedUser(user);
    setLoading(false);
  }, [user]);

  return (
    <header
      className={`fixed left-0 right-0 z-20 border-b border-line bg-surface-primary/95 backdrop-blur-md transition-all duration-500 ${
        isShowFixedHeader ? 'top-0' : 'top-[-70px]'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-3 sm:px-6">
        <Wordmark />
        <div className="hidden lg:flex">
          <HeaderNav />
        </div>
        <div className="flex h-full min-w-[10rem] shrink-0 items-center justify-end gap-2">
          {/* Language is chosen automatically from the visitor's location — see middleware.ts. */}
          <Link
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-primary/80 px-2.5 py-1.5 text-xs font-medium text-content-soft transition-all hover:border-line hover:bg-surface-secondary hover:text-content-main"
            href="/search"
          >
            <IoSearch className="h-3.5 w-3.5 text-content-muted" />
            <span className="hidden md:inline">{t('search')}</span>
          </Link>
          {authenticatedUser && (
            <AccountProfileIcon authenticatedUser={authenticatedUser} isOnFixedHeader={true} />
          )}
          <div className={`relative h-full flex items-center`}>
            {!loading && authenticatedUser && (
              <Notification
                isOnFixedHeader={true}
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
