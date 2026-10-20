/**
 * The `$XTV` holder gate, ported from the reference's token-gate module.
 *
 * This is strictly read-only. The app never mints, signs, or sends anything:
 * it reads a wallet's public key, asks a public RPC how much of the token that
 * wallet holds, and how long it has held it, and unlocks two perks when both
 * conditions pass. The token itself is an ordinary pump.fun SPL mint that
 * already exists — there is no smart contract of ours and no mint authority in
 * the client.
 *
 * Perks (see `canDownload` / `canBoostAudio`):
 *   - the client-side downloader, and
 *   - audio boost above 100%.
 *
 * The thresholds are USD-pegged: they are recomputed from the live token price
 * so a holder always needs roughly the same dollar value, capped so a very
 * cheap token does not demand an absurd unit count.
 */

export const TOKEN_MINT = '6MBf1XdZNSAaDKcxxbnCAngRUxBmwbHS5Ybe2rLRpump';
export const PUMP_URL = `https://pump.fun/coin/${TOKEN_MINT}`;
export const DEXSCREENER_URL =
  'https://dexscreener.com/solana/6qvfmaucjmuauhz1zbqqn2tp41l2xt3agdqisvckdt6n';

/** A public Helius endpoint, used only for read-only balance queries. */
const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=4dfa0d02-62c9-46ae-9a4b-07f9a57989ad';

/** USD value a holder must cover, and the cap on the derived unit count. */
const DOWNLOAD_USD_TARGET = 25;
const BOOST_USD_TARGET = 15;
const MAX_MIN_TOKENS_FOR_DOWNLOAD = 120000;
const MAX_MIN_TOKENS_FOR_BOOST = 100000;

/** The token must have been held at least this long, in seconds (4 hours). */
export const HOLD_SECONDS = 14400;

/** How long a verified session is trusted before a re-check, in ms (4 hours). */
const SESSION_TTL_MS = 14400000;

/** Token price cache lifetime, in ms (5 minutes). */
const PRICE_TTL_MS = 300000;

const SESSION_KEY = 'framextv_token_gate_session';

export interface HolderThresholds {
  minTokensForDownload: number;
  minTokensForBoost: number;
  downloadUsdTarget: number;
  boostUsdTarget: number;
  tokenPriceUsd: number | null;
}

/** Derive the unit thresholds from the live price, capped as the reference does. */
export function thresholdsForPrice(price: number | null): HolderThresholds {
  let minDownload = MAX_MIN_TOKENS_FOR_DOWNLOAD;
  let minBoost = MAX_MIN_TOKENS_FOR_BOOST;
  if (price && price > 0) {
    minDownload = Math.min(MAX_MIN_TOKENS_FOR_DOWNLOAD, Math.ceil(DOWNLOAD_USD_TARGET / price));
    minBoost = Math.min(MAX_MIN_TOKENS_FOR_BOOST, Math.ceil(BOOST_USD_TARGET / price));
  }
  return {
    minTokensForDownload: minDownload,
    minTokensForBoost: minBoost,
    downloadUsdTarget: DOWNLOAD_USD_TARGET,
    boostUsdTarget: BOOST_USD_TARGET,
    tokenPriceUsd: price,
  };
}

let priceCache: { priceUsd: number; lastUpdated: number } | null = null;

/** Token price in USD: DexScreener first, Jupiter as a fallback, 5-minute cache. */
export async function getTokenPrice(force = false): Promise<number | null> {
  const now = Date.now();
  if (!force && priceCache && now - priceCache.lastUpdated < PRICE_TTL_MS) return priceCache.priceUsd;

  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_MINT}`, {
      headers: { Accept: 'application/json' },
    });
    if (response.ok) {
      const body = (await response.json()) as { pairs?: Array<{ priceUsd?: string }> };
      const pair = body.pairs?.find((entry) => entry.priceUsd && !Number.isNaN(parseFloat(entry.priceUsd)));
      if (pair?.priceUsd) {
        const price = parseFloat(pair.priceUsd);
        if (price > 0) {
          priceCache = { priceUsd: price, lastUpdated: now };
          return price;
        }
      }
    }
  } catch (error) {
    console.warn('[TokenGate] DexScreener price fetch failed, trying Jupiter fallback...', error);
  }

  try {
    const response = await fetch(`https://api.jup.ag/price/v2?ids=${TOKEN_MINT}`, {
      headers: { Accept: 'application/json' },
    });
    if (response.ok) {
      const body = (await response.json()) as { data?: Record<string, { price?: string }> };
      const price = parseFloat(body.data?.[TOKEN_MINT]?.price ?? '');
      if (price > 0) {
        priceCache = { priceUsd: price, lastUpdated: now };
        return price;
      }
    }
  } catch (error) {
    console.warn('[TokenGate] Jupiter price fetch failed.', error);
  }

  return priceCache?.priceUsd ?? null;
}

/** A read-only JSON-RPC call against the public Helius endpoint. */
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(HELIUS_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'framextv', method, params }),
  });
  if (!response.ok) throw new Error(`RPC ${method} failed with HTTP ${response.status}`);
  const body = (await response.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || `RPC ${method} error`);
  if (body.result === undefined) throw new Error(`RPC ${method} returned no result`);
  return body.result;
}

interface TokenAccountsResult {
  value?: Array<{
    account?: {
      data?: {
        parsed?: { info?: { tokenAmount?: { uiAmount?: number | null } } };
      };
    };
  }>;
}

/** The wallet's balance of the token, summed across its token accounts. */
export async function getTokenBalance(walletAddress: string): Promise<number> {
  const result = await rpc<TokenAccountsResult>('getTokenAccountsByOwner', [
    walletAddress,
    { mint: TOKEN_MINT },
    { encoding: 'jsonParsed' },
  ]);
  let total = 0;
  for (const entry of result.value ?? []) {
    const amount = entry.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
    if (typeof amount === 'number' && amount > 0) total += amount;
  }
  return total;
}

interface SignaturesResult {
  value?: Array<{ blockTime?: number | null }>;
}

/**
 * The oldest block time among the wallet's recent transactions, used as a
 * stand-in for when it first acquired the token. The reference reads the same
 * 50-signature window and takes the oldest entry.
 */
export async function getFirstAcquiredBlockTime(walletAddress: string): Promise<number | null> {
  const result = await rpc<SignaturesResult>('getSignaturesForAddress', [walletAddress, { limit: 50 }]);
  const times = (result.value ?? [])
    .map((entry) => entry.blockTime)
    .filter((time): time is number => typeof time === 'number' && time > 0);
  if (times.length === 0) return null;
  return Math.min(...times);
}

export interface HolderSession {
  walletAddress: string | null;
  tokenBalance: number;
  tokenPriceUsd: number | null;
  minTokensForDownload: number;
  minTokensForBoost: number;
  hasDownloadBalance: boolean;
  hasBoostBalance: boolean;
  firstAcquiredBlockTime: number | null;
  holdDurationSeconds: number;
  hasHeld4Hours: boolean;
  remainingHoldSeconds: number;
  canDownload: boolean;
  canBoostAudio: boolean;
  lastCheckedAt: number;
  nextCheckAt: number;
  isLoading: boolean;
  error: string | null;
}

export const EMPTY_HOLDER_SESSION: HolderSession = {
  walletAddress: null,
  tokenBalance: 0,
  tokenPriceUsd: null,
  minTokensForDownload: MAX_MIN_TOKENS_FOR_DOWNLOAD,
  minTokensForBoost: MAX_MIN_TOKENS_FOR_BOOST,
  hasDownloadBalance: false,
  hasBoostBalance: false,
  firstAcquiredBlockTime: null,
  holdDurationSeconds: 0,
  hasHeld4Hours: false,
  remainingHoldSeconds: HOLD_SECONDS,
  canDownload: false,
  canBoostAudio: false,
  lastCheckedAt: 0,
  nextCheckAt: 0,
  isLoading: false,
  error: null,
};

/** Read the cached session, re-deriving hold time so it advances while stored. */
export function readHolderSession(): HolderSession | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HolderSession>;
    if (!parsed || typeof parsed !== 'object') return null;
    const now = Math.floor(Date.now() / 1000);
    const held = parsed.firstAcquiredBlockTime
      ? Math.max(0, now - parsed.firstAcquiredBlockTime)
      : parsed.holdDurationSeconds || 0;
    return {
      ...EMPTY_HOLDER_SESSION,
      ...parsed,
      holdDurationSeconds: held,
      hasHeld4Hours: held >= HOLD_SECONDS,
      remainingHoldSeconds: Math.max(0, HOLD_SECONDS - held),
    } as HolderSession;
  } catch {
    return null;
  }
}

export function writeHolderSession(session: HolderSession | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage may be disabled; the gate then simply re-checks every time.
  }
}

/** Whether a stored session still counts, and when it should next be re-checked. */
export function sessionIsFresh(session: HolderSession | null): boolean {
  if (!session) return false;
  return Date.now() < session.nextCheckAt;
}

/**
 * Verify a wallet's holding: price → thresholds → balance → hold time, then
 * fold it into a fresh session record. Read-only throughout.
 */
export async function verifyHolder(walletAddress: string): Promise<HolderSession> {
  const now = Date.now();
  const price = await getTokenPrice();
  const thresholds = thresholdsForPrice(price);

  try {
    const [balance, firstAcquiredBlockTime] = await Promise.all([
      getTokenBalance(walletAddress),
      getFirstAcquiredBlockTime(walletAddress).catch(() => null),
    ]);

    const nowSeconds = Math.floor(now / 1000);
    const holdDurationSeconds = firstAcquiredBlockTime
      ? Math.max(0, nowSeconds - firstAcquiredBlockTime)
      : 0;
    const hasHeld4Hours = holdDurationSeconds >= HOLD_SECONDS;
    const hasDownloadBalance = balance >= thresholds.minTokensForDownload;
    const hasBoostBalance = balance >= thresholds.minTokensForBoost;

    return {
      walletAddress,
      tokenBalance: balance,
      tokenPriceUsd: price,
      minTokensForDownload: thresholds.minTokensForDownload,
      minTokensForBoost: thresholds.minTokensForBoost,
      hasDownloadBalance,
      hasBoostBalance,
      firstAcquiredBlockTime,
      holdDurationSeconds,
      hasHeld4Hours,
      remainingHoldSeconds: Math.max(0, HOLD_SECONDS - holdDurationSeconds),
      canDownload: hasDownloadBalance && hasHeld4Hours,
      canBoostAudio: hasBoostBalance && hasHeld4Hours,
      lastCheckedAt: now,
      nextCheckAt: now + SESSION_TTL_MS,
      isLoading: false,
      error: null,
    };
  } catch (error) {
    return {
      ...EMPTY_HOLDER_SESSION,
      walletAddress,
      tokenPriceUsd: price,
      minTokensForDownload: thresholds.minTokensForDownload,
      minTokensForBoost: thresholds.minTokensForBoost,
      lastCheckedAt: now,
      nextCheckAt: now + 60000,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}
