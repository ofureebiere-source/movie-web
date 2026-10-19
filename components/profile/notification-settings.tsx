'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { IoNotifications, IoCheckmarkCircle, IoCloseCircle, IoHelpCircle } from 'react-icons/io5';
import {
  clearDeviceToken,
  getDeviceToken,
  notificationPermission,
  registerDeviceToken,
  type PushPermission,
} from 'lib/push';

/**
 * "Notifications" — what replaced the account-security screen.
 *
 * There is no password and no second factor, because there is no account. What
 * the viewer can actually control is whether this browser receives release and
 * recommendation notifications, which is a browser permission, not an app
 * setting. So this screen shows that permission's state and offers the one
 * action available: turning notifications on.
 *
 * The device token behind the permission is deliberately not shown — it is an
 * implementation detail of the recommendation engine, not something the viewer
 * manages.
 */
export default function NotificationSettings() {
  const t = useTranslations('profile.notifications');
  const [permission, setPermission] = useState<PushPermission>('unsupported');
  const [hasToken, setHasToken] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setPermission(notificationPermission());
    setHasToken(Boolean(getDeviceToken()));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      await registerDeviceToken();
    } finally {
      refresh();
      setBusy(false);
    }
  }, [refresh]);

  const disable = useCallback(() => {
    clearDeviceToken();
    refresh();
  }, [refresh]);

  const state = (() => {
    if (permission === 'unsupported') {
      return { icon: IoHelpCircle, tone: 'text-content-muted', label: t('stateUnsupported') };
    }
    if (permission === 'denied') {
      return { icon: IoCloseCircle, tone: 'text-red-400', label: t('stateBlocked') };
    }
    if (permission === 'granted' && hasToken) {
      return { icon: IoCheckmarkCircle, tone: 'text-green-400', label: t('stateOn') };
    }
    return { icon: IoHelpCircle, tone: 'text-content-muted', label: t('stateOff') };
  })();

  const StateIcon = state.icon;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-content-main">{t('heading')}</h2>
        <p className="mt-1 text-sm text-content-muted">{t('subtitle')}</p>
      </div>

      <div className="mb-8 flex items-start gap-3 rounded-lg border border-line bg-surface-chip p-4">
        <StateIcon className={`${state.tone} mt-0.5 shrink-0`} size={20} />
        <div className="min-w-0">
          <h3 className="text-content-main font-medium">{t('statusHeading')}</h3>
          <p className="text-content-muted text-sm">{state.label}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {permission === 'granted' && hasToken ? (
          <button
            type="button"
            onClick={disable}
            className="rounded-lg border border-line px-6 py-3 text-content-soft transition-colors hover:bg-surface-chip"
          >
            {t('turnOff')}
          </button>
        ) : (
          <button
            type="button"
            onClick={enable}
            disabled={busy || permission === 'unsupported'}
            className="glass-btn glass-btn-primary"
          >
            <IoNotifications size={16} />
            <span>{busy ? t('enabling') : t('turnOn')}</span>
          </button>
        )}
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <h3 className="mb-4 font-medium text-content-main">{t('howHeading')}</h3>
        <ul className="space-y-3">
          {[t('how1'), t('how2'), t('how3')].map((line) => (
            <li key={line} className="flex items-start gap-3">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-custome-red"></span>
              <p className="text-sm text-content-muted">{line}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
