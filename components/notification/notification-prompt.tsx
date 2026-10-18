'use client';

import { useCallback, useEffect, useState } from 'react';
import { getOrRegisterDevice } from 'lib/device';
import { registerDeviceToken, notificationPermission, type PushPermission } from 'lib/push';

/**
 * Asks the viewer to allow notifications, then records a token for this device.
 *
 * This is the only notification UI the viewer sees. The device id itself is
 * never shown: it is minted and stored by `lib/device.ts`, and the token it is
 * paired with is what the recommendation engine and the release feed address
 * when they push "because you watched X" or a new-episode alert to this
 * browser.
 *
 * The bar is deliberately quiet and appears only when there is something to
 * ask: on a first visit with permission still undecided. A viewer who has
 * already answered — allow or block — never sees it again, and a dismissal is
 * remembered so the ask does not nag.
 */

const DISMISS_KEY = 'nw:push-ask-dismissed';

export default function NotificationPrompt() {
  const [permission, setPermission] = useState<PushPermission>('unsupported');
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPermission(notificationPermission());
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const token = await registerDeviceToken();
      setPermission(token ? 'granted' : notificationPermission());
    } finally {
      setBusy(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode — the bar simply reappears next visit */
    }
    setDismissed(true);
  }, []);

  // Register silently when the viewer has already granted permission, so a
  // returning visitor's token is refreshed without any prompt.
  useEffect(() => {
    if (permission === 'granted') void registerDeviceToken();
  }, [permission]);

  if (permission !== 'default' || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 px-4 lg:bottom-4">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-white/10 bg-black/90 px-4 py-3 text-sm text-gray-200 shadow-2xl backdrop-blur">
        <span className="min-w-0 flex-1">
          Get notified about new releases and picks based on what you watch.
        </span>
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="shrink-0 rounded-lg bg-custome-red px-3 py-1.5 font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? 'Enabling…' : 'Enable'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg px-2 py-1.5 text-gray-400 transition-colors hover:text-white"
          aria-label="Not now"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
