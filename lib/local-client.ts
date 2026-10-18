import { getOrRegisterDevice, type DeviceIdentity } from 'lib/device';

/**
 * The client-side data handle.
 *
 * This used to be `lib/firebase.ts`, which initialised a Firebase app from six
 * `NEXT_PUBLIC_FIREBASE_*` variables and exported the Firestore instance.
 * There is no Firebase any more, and no configuration: `db` is an inert
 * sentinel that the local store ignores (it takes it only so the
 * `doc(db, 'collection', id)` call sites stay unchanged).
 *
 * The account behind that data is this browser, registered on first use — see
 * `lib/device.ts`. `getDeviceAccount` is the one place that turns a device
 * record into the user shape the UI reads (`id`, `name`, `photo`,
 * `createdAt`).
 */

/** Inert stand-in for the Firestore instance. The local store ignores it. */
export const db = { __local: true } as const;

/** The user shape the app reads off Redux. */
export interface DeviceAccount {
  id: string;
  name: string;
  photo: string;
  createdAt: number;
  /** No email: accounts are devices now, and a device has no address. */
  email: null;
  device: DeviceIdentity;
}

export function toDeviceAccount(device: DeviceIdentity): DeviceAccount {
  return {
    id: device.id,
    name: device.name,
    photo: '',
    createdAt: device.createdAt,
    email: null,
    device,
  };
}

/** The current device, registering it if this is the first visit. */
export function getDeviceAccount(): DeviceAccount {
  return toDeviceAccount(getOrRegisterDevice());
}

export default db;
