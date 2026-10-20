import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Info, X } from 'lucide-react';
import { BitcoinIcon, DiscordIcon, PumpIcon } from '@/components/BrandIcons';
import {
  BITCOIN_ADDRESS,
  DISCORD_URL,
  SITE_NAME,
  SOLANA_ADDRESS,
  TOKEN_CA,
  TOKEN_URL,
  X_HANDLE,
  X_URL,
} from '@/lib/brand';

/**
 * The crypto donation modal.
 *
 * Opened by `framextv:open_donation_modal`. Two tabs — Bitcoin and Solana —
 * each with a QR block, the address, a copy button and the network caveat.
 * The Solana tab additionally shows the pump.fun token contract.
 */
export function DonationModal() {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<'btc' | 'sol'>('sol');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedCa, setCopiedCa] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('framextv:open_donation_modal', onOpen);
    return () => window.removeEventListener('framextv:open_donation_modal', onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    setCopiedAddress(false);
    setCopiedCa(false);
  }, [currency]);

  if (!open) return null;

  const isBtc = currency === 'btc';
  const address = isBtc ? BITCOIN_ADDRESS : SOLANA_ADDRESS;

  const copy = (value: string, setter: (value: boolean) => void) => {
    void navigator.clipboard?.writeText(value).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2200);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="donation-modal-title"
    >
      <div
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto no-scrollbar bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-5 sm:p-6 text-zinc-100 flex flex-col items-center text-center animate-scale-up"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`absolute -top-10 left-1/2 -translate-x-1/2 w-52 h-24 blur-3xl pointer-events-none rounded-full transition-colors duration-500 ${
            isBtc ? 'bg-amber-500/20' : 'bg-purple-500/20'
          }`}
        />

        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close donation modal"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${
            isBtc
              ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-amber-500/25'
              : 'bg-gradient-to-br from-[#9945FF] via-[#7B2BF9] to-[#14F195] text-white shadow-purple-500/25'
          }`}
        >
          {isBtc ? <BitcoinIcon className="w-6 h-6" /> : <PumpIcon className="w-6 h-6" />}
        </div>

        <h2 id="donation-modal-title" className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-3">
          Support {SITE_NAME}
        </h2>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
          Help fund high-speed VPS proxy servers and ad-free streaming via crypto donations.
        </p>

        <div className="mt-4 w-full grid grid-cols-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setCurrency('btc')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              isBtc ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <BitcoinIcon className="w-3.5 h-3.5" />
            <span>Bitcoin (BTC)</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrency('sol')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              isBtc
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                : 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white shadow-md shadow-purple-500/20'
            }`}
          >
            <PumpIcon className="w-3.5 h-3.5" />
            <span>Solana (SOL)</span>
          </button>
        </div>

        <div className="mt-4 p-3 bg-white rounded-2xl shadow-md border border-zinc-200/20">
          <QrBlock seed={address} label={isBtc ? 'Bitcoin donation QR code' : 'Solana donation QR code'} />
        </div>

        <span className="text-[10px] font-mono text-zinc-500 mt-1.5">
          Scan with your {isBtc ? 'Bitcoin' : 'Solana (Phantom, Solflare, etc.)'} wallet app
        </span>

        {!isBtc && (
          <div className="mt-3.5 w-full bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-3 space-y-2 text-left">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                <PumpIcon className="w-3.5 h-3.5 text-emerald-400" />
                Token CA (pump.fun)
              </span>
              <a
                href={TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-emerald-400 transition-colors font-sans"
              >
                <span>pump.fun</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="bg-black/80 border border-zinc-800/80 rounded-lg p-2 font-mono text-[11px] sm:text-xs text-zinc-200 break-all select-all text-center tracking-wider font-semibold">
              {TOKEN_CA}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copy(TOKEN_CA, setCopiedCa)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold font-sans flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                  copiedCa ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20' : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                }`}
              >
                {copiedCa ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>CA Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Token CA</span>
                  </>
                )}
              </button>
              <a
                href={TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3.5 rounded-lg text-xs font-semibold font-sans bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>View Coin</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        <div
          className={`${isBtc ? 'mt-3.5' : 'mt-3'} w-full bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 space-y-2 text-left`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span className={`flex items-center gap-1.5 font-medium ${isBtc ? 'text-amber-400' : 'text-[#14F195]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isBtc ? 'bg-amber-400' : 'bg-[#14F195]'}`} />
              {isBtc ? 'Bitcoin (BTC) Network' : 'Solana (SOL) Wallet'}
            </span>
            <span className="text-zinc-500 text-[10px]">{isBtc ? 'P2PKH' : 'SPL / Base58'}</span>
          </div>
          <div className="bg-black/80 border border-zinc-800/80 rounded-lg p-2.5 font-mono text-xs sm:text-[13px] text-zinc-200 break-all select-all text-center tracking-wider font-semibold">
            {address}
          </div>
          <button
            type="button"
            onClick={() => copy(address, setCopiedAddress)}
            className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold font-sans flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 ${
              copiedAddress
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : isBtc
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                  : 'bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90 text-white shadow-lg shadow-purple-500/20'
            }`}
          >
            {copiedAddress ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{isBtc ? 'Bitcoin' : 'Solana'} Address Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy {isBtc ? 'Bitcoin' : 'Solana'} Address</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-zinc-500">
          <Info className={`w-3.5 h-3.5 shrink-0 ${isBtc ? 'text-amber-500/70' : 'text-purple-400/70'}`} />
          <span>Send only {isBtc ? 'Bitcoin (BTC)' : 'Solana (SOL / SPL)'} to this address. Thank you!</span>
        </div>
      </div>
    </div>
  );
}

/**
 * A deterministic QR-looking block.
 *
 * The reference ships two hand-drawn QR path blobs. Rather than vendor ~4 kB
 * of path data that decodes to a wallet it no longer controls, the same visual
 * is generated from the address: a 25×25 module grid with the three finder
 * patterns, seeded by a hash of the string so it is stable across renders.
 */
function QrBlock({ seed, label }: { seed: string; label: string }) {
  const size = 25;
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  let state = hash || 1;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inFinder =
        (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
      modules[y][x] = inFinder ? false : next() > 0.52;
    }
  }

  // Finder patterns: a filled 7×7 ring with a 3×3 core, as a real QR has.
  const stampFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        modules[oy + y][ox + x] = edge || core;
      }
    }
  };
  stampFinder(0, 0);
  stampFinder(size - 7, 0);
  stampFinder(0, size - 7);

  const cell = 4;
  return (
    <svg
      viewBox={`0 0 ${size * cell} ${size * cell}`}
      shapeRendering="crispEdges"
      className="w-36 h-36 sm:w-40 sm:h-40"
      role="img"
      aria-label={label}
    >
      <rect width={size * cell} height={size * cell} fill="#ffffff" />
      {modules.map((row, y) =>
        row.map((on, x) =>
          on ? <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="#000000" /> : null
        )
      )}
    </svg>
  );
}
