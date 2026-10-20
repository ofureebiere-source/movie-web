import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  EMPTY_HOLDER_SESSION,
  readHolderSession,
  sessionIsFresh,
  verifyHolder,
  writeHolderSession,
  type HolderSession,
} from '@/lib/tokenGate';
import { connectPhantom, disconnectPhantom, getPhantomProvider, onPhantomAccountChange } from '@/lib/phantom';

/**
 * The `$XTV` holder context, ported from the reference's token-gate provider.
 *
 * It owns the wallet address and the verified holder session, and re-checks a
 * stale session on a 60 s timer and when the tab regains focus. Two consumers
 * read it: the player (to gate the downloader and audio boost) and the perks
 * modal. Nothing leaves the device — the check is a read-only balance query.
 */

interface HolderContextValue {
  walletAddress: string | null;
  holderStatus: HolderSession;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
}

const HolderContext = createContext<HolderContextValue | undefined>(undefined);

export function HolderProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(
    () => readHolderSession()?.walletAddress ?? null
  );
  const [holderStatus, setHolderStatus] = useState<HolderSession>(
    () => readHolderSession() ?? EMPTY_HOLDER_SESSION
  );
  const [isConnecting, setIsConnecting] = useState(false);
  // Guards the periodic re-check against overlapping runs.
  const checking = useRef(false);

  const check = useCallback(async (address: string, force = false) => {
    if (checking.current) return;
    const stored = readHolderSession();
    if (!force && stored && sessionIsFresh(stored)) {
      setHolderStatus(stored);
      return;
    }
    checking.current = true;
    setHolderStatus((prev) => ({ ...prev, walletAddress: address, isLoading: true }));
    try {
      const session = await verifyHolder(address);
      writeHolderSession(session);
      setHolderStatus(session);
    } catch (error) {
      setHolderStatus((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      }));
    } finally {
      checking.current = false;
    }
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const address = await connectPhantom();
      if (address) {
        setWalletAddress(address);
        await check(address, true);
      }
    } catch (error) {
      console.warn('[TokenGate] connect failed:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [check]);

  const disconnect = useCallback(async () => {
    await disconnectPhantom();
    writeHolderSession(null);
    setWalletAddress(null);
    setHolderStatus(EMPTY_HOLDER_SESSION);
  }, []);

  const refresh = useCallback(async () => {
    if (walletAddress) await check(walletAddress, true);
  }, [walletAddress, check]);

  // Silent reconnect for a returning visitor, then the first verification.
  useEffect(() => {
    const provider = getPhantomProvider();
    if (!provider) return;
    void connectPhantom(true)
      .then((address) => {
        if (address) {
          setWalletAddress(address);
          void check(address);
        }
      })
      .catch(() => undefined);
  }, [check]);

  // Follow the wallet if the account changes or is disconnected in Phantom.
  useEffect(() => {
    const unsubscribe = onPhantomAccountChange(
      (address) => {
        if (address) {
          setWalletAddress(address);
          void check(address, true);
        } else {
          setWalletAddress(null);
          setHolderStatus(EMPTY_HOLDER_SESSION);
          writeHolderSession(null);
        }
      },
      () => {
        setWalletAddress(null);
        setHolderStatus(EMPTY_HOLDER_SESSION);
        writeHolderSession(null);
      }
    );
    return unsubscribe;
  }, [check]);

  // Re-check a stale session on a timer and when the tab becomes visible.
  useEffect(() => {
    if (!walletAddress) return;
    void check(walletAddress);
    const timer = window.setInterval(() => {
      if (!checking.current) {
        const stored = readHolderSession();
        if (stored && !sessionIsFresh(stored)) void check(walletAddress);
      }
    }, 60000);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !checking.current) {
        const stored = readHolderSession();
        if (stored && !sessionIsFresh(stored)) void check(walletAddress);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [walletAddress, check]);

  return (
    <HolderContext.Provider value={{ walletAddress, holderStatus, isConnecting, connect, disconnect, refresh }}>
      {children}
    </HolderContext.Provider>
  );
}

export function useHolder(): HolderContextValue {
  const context = useContext(HolderContext);
  if (!context) throw new Error('useHolder must be used within a HolderProvider');
  return context;
}
