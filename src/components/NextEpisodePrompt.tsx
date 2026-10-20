import { Play, Sparkles, X } from 'lucide-react';

/**
 * The "Up Next" countdown card.
 *
 * Ported 1:1 from frameXTV.xyz's `NextEpisodePrompt` (the `ve` component in its
 * `WatchPage` chunk): a thumbnail (or the title's backdrop), the next episode
 * label, an autoplay switch, Cancel / Play Now, and a progress bar that fills
 * over the ten-second countdown.
 */
export default function NextEpisodePrompt({
  nextEpisodeLabel,
  countdown,
  onPlayNow,
  onCancel,
  thumbnail,
  className = '',
  isAutoplayEnabled = true,
  onToggleAutoplay,
}: {
  nextEpisodeLabel?: string | null;
  countdown: number;
  onPlayNow: () => void;
  onCancel: () => void;
  thumbnail?: string;
  className?: string;
  isAutoplayEnabled?: boolean;
  onToggleAutoplay?: () => void;
}) {
  const width = Math.max(0, Math.min(100, (countdown / 10) * 100));

  return (
    <div
      data-testid="next-episode-prompt"
      role="region"
      aria-label="Next Episode Countdown"
      className={`w-full max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 animate-fade-in ${className}`}
    >
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-zinc-950/95 border border-zinc-800/90 shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          {thumbnail ? (
            <div className="relative w-16 h-10 sm:w-20 sm:h-12 rounded-lg bg-zinc-900 overflow-hidden border border-zinc-800 shrink-0">
              <img src={thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
          )}

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase">
                Up Next
              </span>
              {isAutoplayEnabled ? (
                <span className="text-xs font-mono text-rose-400 font-semibold">Playing in {countdown}s</span>
              ) : (
                <span className="text-xs font-mono text-zinc-400 font-semibold">Autoplay Off • Play when ready</span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
              {nextEpisodeLabel || 'Next Episode'}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          {onToggleAutoplay && (
            <button
              type="button"
              data-testid="next-prompt-autoplay-toggle"
              onClick={onToggleAutoplay}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer active:scale-95 ${
                isAutoplayEnabled
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
              title={isAutoplayEnabled ? 'Autoplay is On (click to disable)' : 'Autoplay is Off (click to enable)'}
            >
              <span className="text-[11px] font-mono">Autoplay:</span>
              <span className={isAutoplayEnabled ? 'text-rose-400 font-bold' : 'text-zinc-500'}>
                {isAutoplayEnabled ? 'On' : 'Off'}
              </span>
            </button>
          )}

          <button
            type="button"
            data-testid="next-prompt-cancel"
            onClick={onCancel}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer active:scale-95"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>

          <button
            type="button"
            data-testid="next-prompt-play-now"
            onClick={onPlayNow}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            <span>Play Now</span>
          </button>
        </div>

        {isAutoplayEnabled && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-900">
            <div
              data-testid="next-prompt-progress-bar"
              className="h-full bg-rose-500 transition-all duration-1000 ease-linear"
              style={{ width: `${width}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
