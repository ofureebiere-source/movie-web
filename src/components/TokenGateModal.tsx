import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink, RefreshCw, X, Zap } from 'lucide-react';
import { useHolder } from '@/hooks/HolderContext';
import { DEXSCREENER_URL, PUMP_URL, TOKEN_MINT } from '@/lib/tokenGate';
import { isPhantomInstalled } from '@/lib/phantom';

/**
 * The `$XTV` holder perks modal, ported from the reference's token-gate modal.
 *
 * Three entry points open it — the download row, the audio-boost row, and the
 * wallet badge — and it renders a different headline for each. When the wallet
 * qualifies it shows the active perks; otherwise it shows the balance and how
 * far off the viewer is, with a link to buy. All figures come from the
 * read-only holder session.
 */

export type TokenGateMode = 'download' | 'audio_boost' | 'perks';

function shortAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const TITLES: Record<TokenGateMode, string> = {
  download: 'Unlock Downloads',
  audio_boost: 'Unlock Audio Boost',
  perks: '$XTV Holder Perks',
};

export default function TokenGateModal({ mode, onClose }: { mode: TokenGateMode; onClose: () => void }) {
  const { walletAddress, holderStatus, isConnecting, connect, disconnect, refresh } = useHolder();
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const required = mode === 'audio_boost' ? holderStatus.minTokensForBoost : holderStatus.minTokensForDownload;
  const unlocked = mode === 'audio_boost' ? holderStatus.canBoostAudio : holderStatus.canDownload;
  const hasBalance = mode === 'audio_boost' ? holderStatus.hasBoostBalance : holderStatus.hasDownloadBalance;
  const remainingHold = holderStatus.remainingHoldSeconds;
  const shortfall = Math.max(0, required - holderStatus.tokenBalance);

  const copy = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-zinc-800/70">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {unlocked ? '$XTV Holder Perks' : TITLES[mode]}
                </h2>
                {unlocked && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                {unlocked
                  ? 'All premium perks are active on your wallet.'
                  : `Requires ≥${required.toLocaleString()} $XTV held for 4+ hours.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3.5">
          {walletAddress ? (
            <>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${unlocked ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="font-mono text-zinc-300 font-semibold">{shortAddress(walletAddress)}</span>
                    <button
                      type="button"
                      onClick={copy}
                      title="Copy address"
                      className="p-1 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={doRefresh}
                      disabled={refreshing || holderStatus.isLoading}
                      title="Refresh balance"
                      className="p-1 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshing || holderStatus.isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void disconnect()}
                      title="Disconnect wallet"
                      className="p-1 text-zinc-400 hover:text-red-400 rounded transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-1 border-t border-zinc-800">
                  <span className="text-xs text-zinc-400">Balance:</span>
                  <span className="text-sm font-mono font-bold text-white">
                    {holderStatus.tokenBalance.toLocaleString()} / {required.toLocaleString()} $XTV
                  </span>
                </div>

                {hasBalance ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex items-center justify-between text-xs text-amber-300">
                    <span>Held: {formatDuration(holderStatus.holdDurationSeconds)}</span>
                    {!holderStatus.hasHeld4Hours && (
                      <span className="font-mono font-semibold">Unlocks in {formatDuration(remainingHold)}</span>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex items-start gap-2 text-xs text-red-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span>Needs {shortfall.toLocaleString()} more $XTV to unlock.</span>
                  </div>
                )}
              </div>

              {unlocked && (
                <div className="bg-zinc-900/40 border border-zinc-800/70 rounded-xl p-3 space-y-1.5 text-xs">
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Active Member Perks</span>
                  <div className="space-y-1 pt-0.5 text-zinc-300">
                    {[
                      'Client-Side MP4 Downloader (instant direct save)',
                      '200% & 300% maximum audio boost',
                      'Dialogue speech clarity mode (+6 dB vocal lift)',
                    ].map((perk) => (
                      <div key={perk} className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{perk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Connect a Phantom wallet holding {required.toLocaleString()} $XTV for at least 4 hours to unlock this
                perk. The check is read-only — nothing is ever signed.
              </p>
              <button
                type="button"
                onClick={() => void connect()}
                disabled={isConnecting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                {isConnecting ? 'Connecting…' : isPhantomInstalled() ? 'Connect Phantom' : 'Install Phantom'}
              </button>
            </div>
          )}

          {holderStatus.error && <p className="text-[11px] text-red-400">{holderStatus.error}</p>}

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/70">
            <span className="text-[10px] font-mono text-zinc-500 truncate" title={TOKEN_MINT}>
              CA: {shortAddress(TOKEN_MINT)}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href={PUMP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors"
              >
                pump.fun <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={DEXSCREENER_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors"
              >
                Chart <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
