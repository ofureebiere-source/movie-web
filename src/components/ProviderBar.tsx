import { useState } from 'react';
import { Check, ChevronDown, Server } from 'lucide-react';
import type { FxProvider } from '@/lib/api';

/**
 * The provider bar above the player.
 *
 * The reference only exposes server switching from inside the player chrome.
 * This surfaces it at the top of the watch screen as well: the active provider
 * is named up front, and the dropdown switches it. Selecting a provider
 * re-requests the stream through the embed URL's `provider` parameter, so the
 * player and the bar never disagree about which server answered.
 */
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

  return (
    <div
      data-testid="provider-bar"
      className="w-full flex items-center justify-between gap-2 rounded-xl bg-zinc-950/80 border border-white/[0.06] backdrop-blur-md px-3 py-2"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Server className="w-3.5 h-3.5 text-rose-500 shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 shrink-0">Provider</span>
        <span className="text-xs font-semibold text-white truncate">{label}</span>
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
            className="absolute top-full right-0 mt-2 w-64 max-h-72 overflow-y-auto bg-zinc-950/98 border border-zinc-800 rounded-xl p-1.5 shadow-2xl z-30"
          >
            <button
              type="button"
              role="option"
              aria-selected={!activeProvider}
              onClick={() => {
                onSelect(undefined);
                setOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer flex items-center justify-between ${
                !activeProvider ? 'bg-white text-black font-bold' : 'text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              <span>Auto (best available)</span>
              {!activeProvider && <Check className="w-3 h-3" />}
            </button>

            {providers.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="option"
                aria-selected={activeProvider === entry.id}
                onClick={() => {
                  onSelect(entry.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer flex items-center justify-between ${
                  activeProvider === entry.id ? 'bg-white text-black font-bold' : 'text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <span className="truncate">
                  {entry.name}
                  {entry.tagline ? ` — ${entry.tagline}` : ''}
                </span>
                {activeProvider === entry.id && <Check className="w-3 h-3" />}
              </button>
            ))}

            {providers.length === 0 && (
              <p className="px-2.5 py-1.5 text-[11px] text-zinc-500">No providers available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
