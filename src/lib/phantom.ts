/**
 * Phantom wallet helpers, ported from the reference.
 *
 * Only the connection is used — the public key. Nothing here ever asks the
 * wallet to sign or send anything; the token gate is a read-only balance check.
 * When Phantom is absent the reference offers its install page, and on a phone
 * it deep-links into the in-app browser so the connection happens on the
 * device's own wallet.
 */

export function getPhantomProvider(): SolanaProvider | null {
  if (typeof window === 'undefined') return null;
  const scoped = window as Window & { phantom?: { solana?: SolanaProvider }; solana?: SolanaProvider };
  if (scoped.phantom?.solana?.isPhantom) return scoped.phantom.solana;
  if (scoped.solana?.isPhantom && !scoped.solana?.isBraveWallet) return scoped.solana;
  return null;
}

export function isPhantomInstalled(): boolean {
  return getPhantomProvider() !== null;
}

function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Send the viewer to Phantom — a deep link on mobile, the site on desktop. */
export function openPhantomInstall(): void {
  if (typeof window === 'undefined') return;
  if (isMobile()) {
    const target = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}?ref=${encodeURIComponent(window.location.origin)}`;
    window.location.href = target;
    return;
  }
  window.open('https://phantom.app/', '_blank', 'noopener,noreferrer');
}

/**
 * Connect to Phantom and return the public key.
 *
 * `onlyIfTrusted` is the silent path: it resolves only when the site is already
 * approved, so a returning visitor is recognised without a prompt. A user
 * rejection (code 4001) is surfaced as a friendly error; any other failure in
 * the silent path is swallowed so it does not look like a crash.
 */
export async function connectPhantom(onlyIfTrusted = false): Promise<string | null> {
  const provider = getPhantomProvider();
  if (!provider) {
    openPhantomInstall();
    return null;
  }
  try {
    const result = await provider.connect({ onlyIfTrusted });
    return result?.publicKey ? result.publicKey.toString() : null;
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 4001) throw new Error('Wallet connection rejected by user.');
    if (!onlyIfTrusted) {
      console.warn('[PhantomWallet] Connection error:', error);
      throw error;
    }
  }
  return null;
}

export async function disconnectPhantom(): Promise<void> {
  const provider = getPhantomProvider();
  if (provider) {
    try {
      await provider.disconnect();
    } catch (error) {
      console.warn('[PhantomWallet] Disconnect error:', error);
    }
  }
}

/** Subscribe to Phantom's account/disconnect events; returns an unsubscribe. */
export function onPhantomAccountChange(
  onAccount: (publicKey: string | null) => void,
  onDisconnect: () => void
): () => void {
  const provider = getPhantomProvider();
  if (!provider) return () => {};
  const accountHandler = (...args: unknown[]) => {
    const key = args[0] as { toString: () => string } | undefined;
    onAccount(key ? key.toString() : null);
  };
  const disconnectHandler = () => onDisconnect();
  provider.on('accountChanged', accountHandler);
  provider.on('disconnect', disconnectHandler);
  return () => {
    provider.removeListener('accountChanged', accountHandler);
    provider.removeListener('disconnect', disconnectHandler);
  };
}
