import { useState } from 'react';
import { Check, ChevronDown, Download, Server } from 'lucide-react';
import type { FxProvider } from '@/lib/api';

/**
 * The provider bar above the player.
 *
 * The reference only exposes server switching from inside the player chrome.
 * This surfaces it at the top of the watch screen as well: the active provider
 * is named up front, and the dropdown switches it. Selecting a provider
 * re-requests the stream through the embed URL's `provider` parameter, so the
 * bar and the player never disagree about which server answered.
 *
 * The rows carry the annotations the reference's server menu carries: a
 * quality badge read from the provider's own tagline, the capability flags its
 * id implies, and a status line.
 */

const CAPABILITY_FLAGS: Array<{ match: RegExp; label: string; className: string }> = [
  {
    match: /bowler|multi-?lang/i,
    label: 'Multi-Lang',
    className: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
  {
    match: /giant|multi-?audio/i,
    label: 'Multi-Audio',
    className: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
  {
    match: /titan|films365/i,
    label: 'Download',
    className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
];

const QUALITY_CLASS = {
  '4K': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  FHD: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
} as const;

/** Read a quality badge out of the provider's tagline, as the reference does. */
function qualityOf(provider: FxProvider): keyof typeof QUALITY_CLASS | null {
  const text = `${provider.tagline ?? ''} ${provider.name ?? ''}`.toLowerCase();
  if (text.includes('4k')) return '4K';
  if (text.includes('1080') || text.includes('fhd') || text.includes('hd')) return 'FHD';
  return null;
}

function statusOf(provider: FxProvider): { label: string; className: string } | null {
  switch (provider.status) {
    case 'available':
      return { label: 'Available', className: 'text-emerald-400' };
    case 'checking':
      return { label: 'Checking…', className: 'text-amber-400' };
    case 'unavailable':
      return { label: 'Unavailable', className: 'text-zinc-600' };
    default:
      return null;
  }
}

export default function ProviderBar({
  providers,
  activeProvider,
  onSelect,
  loading = false,
}: {
  providers: FxProvider[];
  activeProvider?: string;
  onSelect: (provider: string | undefined) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const active = providers.find((entry) => entry.id === activeProvider);
  const label = active ? active.name : 'Auto (best available)';
  const activeQuality = active ? qualityOf(active) : null;

  return (
    <div
      data-testid="provider-bar"
      className="w-full flex items-center justify-between gap-2 rounded-xl bg-zinc-950/80 border border-white/[0.06] backdrop-blur-md px-3 py-2"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Server className="w-3.5 h-3.5 text-rose-500 shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 shrink-0">Provider</span>
        <span className="text-xs font-semibold text-white truncate">{label}</span>
        {activeQuality && (
          <span
            className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border shrink-0 ${QUALITY_CLASS[activeQuality]}`}
          >
            {activeQuality}
          </span>
        )}
        {loading && (
          <span className="w-2.5 h-2.5 rounded-full border border-amber-400/30 border-t-amber-400 animate-spin shrink-0" />
        )}
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Change provider"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-white/[0.08] text-zinc-200 hover:text-white text-xs font-medium transition-colors cursor-pointer"
        >
          <span>Change</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute top-full right-0 mt-2 w-[min(18rem,calc(100vw-1.5rem))] max-h-[min(22rem,70vh)] overflow-y-auto bg-zinc-950/98 border border-zinc-800 rounded-xl p-1.5 shadow-2xl z-30"
          >
            <button
              type="button"
              role="option"
              aria-selected={!activeProvider}
              onClick={() => {
                onSelect(undefined);
                setOpen(false);
              }}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] transition-colors cursor-pointer flex items-center justify-between gap-2 border ${
                !activeProvider
                  ? 'bg-zinc-900 border-blue-500/50 text-white'
                  : 'border-transparent text-zinc-300 hover:bg-zinc-900/60'
              }`}
            >
              <span className="font-bold truncate">Auto (best available)</span>
              {!activeProvider && <Check className="w-3 h-3 shrink-0" />}
            </button>

            {providers.map((entry) => {
              const selected = activeProvider === entry.id;
              const quality = qualityOf(entry);
              const status = statusOf(entry);
              const flags = CAPABILITY_FLAGS.filter((flag) => flag.match.test(entry.id));
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onSelect(entry.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] transition-colors cursor-pointer flex items-center justify-between gap-2 border ${
                    selected
                      ? 'bg-zinc-900 border-blue-500/50 text-white'
                      : 'border-transparent text-zinc-300 hover:bg-zinc-900/60'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-bold tracking-tight truncate">{entry.name}</span>
                    {quality && (
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border shrink-0 ${QUALITY_CLASS[quality]}`}
                      >
                        {quality}
                      </span>
                    )}
                    {flags.map((flag) => (
                      <span
                        key={flag.label}
                        className={`flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border shrink-0 ${flag.className}`}
                      >
                        {flag.label === 'Download' && <Download className="w-2.5 h-2.5" />}
                        {flag.label}
                      </span>
                    ))}
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {selected ? (
                      <>
                        <span className="text-[10px] text-emerald-400">Connected</span>
                        <Check className="w-3 h-3 text-emerald-400" />
                      </>
                    ) : (
                      status && <span className={`text-[10px] ${status.className}`}>{status.label}</span>
                    )}
                  </span>
                </button>
              );
            })}

            {providers.length === 0 && (
              <p className="px-2.5 py-2 text-[11px] text-zinc-500">No providers available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
