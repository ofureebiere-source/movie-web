import { Bug, ExternalLink, X } from 'lucide-react';
import { DiscordIcon, XIcon } from '@/components/BrandIcons';
import { DISCORD_URL, X_HANDLE, X_URL } from '@/lib/brand';

/**
 * The Discord call-to-action banner.
 *
 * Ported 1:1 from frameXTV.xyz's `DiscordBanner` (the `index` chunk's `vu`):
 * a pulsing Discord mark, a "Report Issues & Feedback" chip, a line of copy,
 * the X handle, a "Join Discord" button, and a close button. Shown at the top
 * of the stream configurator and dismissible for good through
 * `discordBannerDismissed`.
 */
export default function DiscordBanner({ onClose, className = '' }: { onClose?: () => void; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 sm:p-4 shadow-lg transition-all duration-300 ${className}`}
    >
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="relative shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-white text-black font-bold shadow">
            <DiscordIcon className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-300" />
            </span>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-xs sm:text-sm tracking-tight">
                Join our Discord Community
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 font-medium">
                <Bug className="w-3 h-3 text-zinc-400" /> Report Issues &amp; Feedback
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 max-w-xl leading-relaxed">
              Found a bug or issue? Want to request new features or providers? Join our official Discord server to let
              us know directly!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={`Follow frameXTV on X (${X_HANDLE})`}
            className="hidden sm:inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-medium tracking-wide transition-all shadow"
          >
            <XIcon className="w-3.5 h-3.5" />
            <span>{X_HANDLE}</span>
          </a>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black text-xs font-bold tracking-wide transition-all shadow"
          >
            <DiscordIcon className="w-3.5 h-3.5" />
            <span>Join Discord</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </a>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Dismiss banner"
              aria-label="Close Discord banner"
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
