'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setUser } from '../../redux/slices/user-slice';
import { getDeviceAccount, toDeviceAccount, type DeviceAccount } from '../../lib/local-client';
import { renameDevice } from '../../lib/device';

/**
 * Registers this browser and publishes the account to Redux.
 *
 * There is no sign-up form and no sign-in: on first mount the device is
 * registered (see `lib/device.ts`) and its record becomes the app's user.
 * Every screen that reads `state.auth.user` then works unchanged.
 *
 * Registration is client-only — it writes to `localStorage` — so the provider
 * renders children immediately and fills the account in on mount. That keeps
 * the first paint identical to the old build's, where the user was also
 * absent until the client resolved it.
 */

interface DeviceAuthContextValue {
  /** The registered device account, or null before the client mount. */
  account: DeviceAccount | null;
  /** Change the device's display name. */
  rename: (name: string) => void;
  /**
   * Register the device if it is not yet registered, publish it to Redux and
   * return it. Synchronous, so an action handler can call it mid-click and
   * carry on with the returned account rather than dead-ending.
   */
  ensureRegistered: () => DeviceAccount;
}

const DeviceAuthContext = createContext<DeviceAuthContextValue>({
  account: null,
  rename: () => {},
  ensureRegistered: () => getDeviceAccount(),
});

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const [account, setAccount] = useState<DeviceAccount | null>(null);

  useEffect(() => {
    const registered = getDeviceAccount();
    setAccount(registered);
    dispatch(setUser(registered));
  }, [dispatch]);

  const rename = (name: string) => {
    const updated = toDeviceAccount(renameDevice(name));
    setAccount(updated);
    dispatch(setUser(updated));
  };

  const ensureRegistered = () => {
    const registered = getDeviceAccount();
    if (!account || account.id !== registered.id || account.name !== registered.name) {
      setAccount(registered);
      dispatch(setUser(registered));
    }
    return registered;
  };

  return (
    <DeviceAuthContext.Provider value={{ account, rename, ensureRegistered }}>
      {children}
    </DeviceAuthContext.Provider>
  );
}

export function useDeviceAuth(): DeviceAuthContextValue {
  return useContext(DeviceAuthContext);
}
