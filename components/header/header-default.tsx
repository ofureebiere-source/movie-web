import { Link } from 'i18n/routing';
import Wordmark from '../commons/wordmark';
import { IoSearch } from 'react-icons/io5';
import HeaderNav from './header-nav';
import { useSelector } from 'react-redux';
import AccountProfileIcon from '../account/account-profile-icon';
import { useEffect, useState } from 'react';
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
  const t = useTranslations('header');
  const user = useSelector((state: any) => state.auth.user);
  const [authenticatedUser, setAuthenticatedUser] = useState<object | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setAuthenticatedUser(user);
    setLoading(false);
  }, [user]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.05] bg-black/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-3 sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <Wordmark />
        </div>

        <div className="hidden lg:flex">
          <HeaderNav />
        </div>

        <div className="flex h-full min-w-[10rem] shrink-0 items-center justify-end gap-2">
          {/* Language is chosen automatically from the visitor's location — see middleware.ts. */}
          <Link
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-zinc-950/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:border-white/[0.15] hover:bg-zinc-900 hover:text-white"
            href="/search"
          >
            <IoSearch className="h-3.5 w-3.5 text-zinc-400" />
            <span className="hidden md:inline">{t('search')}</span>
          </Link>
          {authenticatedUser && (
            <AccountProfileIcon authenticatedUser={authenticatedUser} isOnFixedHeader={false} />
          )}
          <div className={`relative flex h-full items-center`}>
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
