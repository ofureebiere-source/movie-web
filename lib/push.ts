/**
 * Notification permission and this device's token.
 *
 * The app is keyless, so there is no push service credential and no
 * subscription endpoint to hand to a server. What this module does is the part
 * that does not need one: it asks the browser for permission and mints a
 * stable, per-device token, pairing it with the device id from `lib/device.ts`.
 * The recommendation engine and the release feed read that pairing to decide
 * what to deliver to this browser.
 *
 * When a push service is wired up later, the subscription this returns is the
 * only thing that changes — the call sites and the token shape stay.
 */

import { getOrRegisterDevice } from 'lib/device';

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

const TOKEN_KEY = 'nw:push-token';

export interface DeviceToken {
  /** Opaque token the notification engine addresses. */
  token: string;
  /** The device this token belongs to. */
  deviceId: string;
  createdAt: string;
}

function randomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The browser's current permission, without prompting. */
export function notificationPermission(): PushPermission {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as PushPermission;
}

/** This device's token, or null before permission was granted. */
export function getDeviceToken(): DeviceToken | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeviceToken>;
    return parsed?.token && parsed.deviceId ? (parsed as DeviceToken) : null;
  } catch {
    return null;
  }
}

/**
 * Ask for permission (if still undecided) and record a token for this device.
 *
 * Idempotent: calling it again returns the existing token rather than minting a
 * new one, so the engine's view of the device stays stable. Returns null when
 * permission is denied, unsupported, or the ask was declined.
 */
export async function registerDeviceToken(): Promise<DeviceToken | null> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return null;

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return null;

  const device = getOrRegisterDevice();
  const existing = getDeviceToken();
  if (existing && existing.deviceId === device.id) return existing;

  const token: DeviceToken = {
    token: randomToken(),
    deviceId: device.id,
    createdAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  } catch {
    return token;
  }
  return token;
}

/** Forget this device's token (used when the device is forgotten). */
export function clearDeviceToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
}

/**
 * Show a notification on this device.
 *
 * A no-op unless permission is granted, so callers do not have to check.
 */
export function showLocalNotification(title: string, body: string, url?: string): void {
  if (notificationPermission() !== 'granted') return;
  try {
    const notification = new Notification(title, { body, icon: '/mini-logo.png' });
    if (url) {
      notification.onclick = () => {
        window.focus();
        window.location.href = url;
      };
    }
  } catch {
    /* Some browsers forbid constructing notifications outside a service worker. */
  }
}
