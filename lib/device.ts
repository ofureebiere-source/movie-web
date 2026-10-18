/**
 * This browser's identity.
 *
 * There is no sign-up and no sign-in. The first time the app loads it mints a
 * random device id, keeps it in `localStorage`, and treats that id as the
 * account: collections, comments, notifications and watch history are all
 * keyed by it. That is the whole authentication story — keyless, and it needs
 * no provider, no email and no password.
 *
 * The trade is honest and worth stating: the identity lives in one browser.
 * Clearing site data, or opening the app on another device, starts a fresh
 * account. That is the same behaviour the local stores have anyway.
 *
 * A record is kept alongside the id so the profile screen has something to
 * show and the viewer can rename the device.
 */

const DEVICE_KEY = 'nw:device';

export interface DeviceIdentity {
  /** Stable per-browser id. Doubles as the user id everywhere in the app. */
  id: string;
  /** Human label, editable from the profile screen. */
  name: string;
  createdAt: number;
  /** ISO timestamp of the last time the app saw this device. */
  lastSeenAt: string;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // `randomUUID` needs a secure context; fall back for plain-HTTP hosts.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Short, readable form of the id, for the default device name. */
function shortCode(id: string): string {
  return id.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase();
}

function defaultName(id: string): string {
  return `Thiết bị ${shortCode(id)}`;
}

function read(): DeviceIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DEVICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeviceIdentity>;
    if (!parsed?.id) return null;
    return {
      id: parsed.id,
      name: parsed.name || defaultName(parsed.id),
      createdAt: parsed.createdAt ?? Date.now(),
      lastSeenAt: parsed.lastSeenAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function write(device: DeviceIdentity): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
}

/**
 * The current device, registering it on first call.
 *
 * Safe to call from anywhere — every call after the first returns the same
 * record, and the `lastSeenAt` stamp is refreshed each time.
 */
export function getOrRegisterDevice(): DeviceIdentity {
  const existing = read();
  if (existing) {
    const touched = { ...existing, lastSeenAt: new Date().toISOString() };
    write(touched);
    return touched;
  }
  const id = randomId();
  const device: DeviceIdentity = {
    id,
    name: defaultName(id),
    createdAt: Date.now(),
    lastSeenAt: new Date().toISOString(),
  };
  write(device);
  return device;
}

/** Read the device without registering one. Null before first registration. */
export function getDevice(): DeviceIdentity | null {
  return read();
}

/** Rename the device. Returns the updated record. */
export function renameDevice(name: string): DeviceIdentity {
  const device = getOrRegisterDevice();
  const updated = { ...device, name: name.trim() || device.name };
  write(updated);
  return updated;
}

/**
 * Forget the device. The id is discarded, so the next load registers a new
 * one — the equivalent of signing out of an account, except that the old
 * identity is not recoverable and its data is left orphaned in `localStorage`.
 */
export function forgetDevice(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DEVICE_KEY);
}
