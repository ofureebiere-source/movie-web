import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Clock, Play, RotateCcw, Trash2, Tv } from 'lucide-react';
import {
  clearAllProgress,
  formatRemaining,
  formatTime,
  removeProgress,
  useWatchHistory,
  type ProgressEntry,
} from '@/lib/watchProgress';
import { mediaId } from '@/lib/id';
import { pageTitle } from '@/lib/brand';

/**
 * The watch history page.
 *
 * Ported 1:1 from frameXTV.xyz's `HistoryPage`: a sticky sub-header under the
 * 14-unit top bar, then "Continue Watching" (anything under 92% with at least
 * 15 s on the clock) and "Completed" as two grids of 16:9 cards. Each card
 * carries a progress bar, an episode badge, the resume position and remaining
 * time, a Resume button, and a per-entry delete. Clearing everything goes
 * through a confirmation dialog, as upstream.
 */
export default function HistoryPage() {
  const { items, refresh } = useWatchHistory();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    document.title = pageTitle('Watch History');
  }, []);

  const inProgress = items.filter((entry) => !entry.completed && entry.timestamp >= 15);
  const completed = items.filter((entry) => entry.completed);
  const hasAny = items.length > 0;

  const remove = useCallback(
    (entry: ProgressEntry) => {
      removeProgress(entry.mediaType, entry.id, entry.season, entry.episode);
      refresh();
    },
    [refresh]
  );

  const confirmClear = () => {
    clearAllProgress();
    setConfirming(false);
    refresh();
  };

  return (
    <div className="w-full min-h-screen bg-black text-zinc-100 flex flex-col pb-20">
      <div className="border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-md sticky top-14 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-rose-500" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Watch History</h1>
            </div>
            <p className="text-xs text-zinc-400">Locally saved playback progress on this device</p>
          </div>

          {hasAny && (
            <button
              type="button"
              data-testid="clear-history-btn"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/30 text-zinc-300 hover:text-red-400 text-xs font-medium transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-10">
        {hasAny ? (
          <>
            {inProgress.length > 0 && (
              <section className="space-y-4" data-testid="history-in-progress-section">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>Continue Watching</span>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 text-[10px] font-mono">
                      {inProgress.length}
                    </span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {inProgress.map((entry) => (
                    <HistoryCard key={`ip-${keyOf(entry)}`} entry={entry} onRemove={remove} />
                  ))}
                </div>
              </section>
            )}

            {completed.length > 0 && (
              <section className="space-y-4" data-testid="history-completed-section">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>Completed</span>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 text-[10px] font-mono">
                      {completed.length}
                    </span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {completed.map((entry) => (
                    <HistoryCard key={`done-${keyOf(entry)}`} entry={entry} onRemove={remove} />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <div data-testid="history-empty-state" className="py-16 px-4 text-center max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500 flex items-center justify-center mx-auto shadow-sm">
              <Clock className="w-7 h-7 opacity-60" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base sm:text-lg font-bold text-white">No Watch History Yet</h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Movies, TV series, and anime you start streaming will automatically appear here so you can pick up
                where you left off.
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <span>Discover Content</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-clear-title"
          data-testid="clear-history-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="absolute inset-0 cursor-pointer" onClick={() => setConfirming(false)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 text-left animate-scale-up">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h3 id="confirm-clear-title" className="text-base font-bold text-white">
                Clear watch history?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                This removes all locally stored frameXTV watch progress and resume positions from this device. This
                action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-clear-history-btn"
                onClick={confirmClear}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function keyOf(entry: ProgressEntry): string {
  return `${entry.mediaType}-${entry.id}-${entry.season || 1}-${entry.episode || 1}`;
}

function watchUrl(entry: ProgressEntry): string {
  if (entry.mediaType === 'anime') return `/watch/anime/${entry.id}/${entry.episode || 1}`;
  if (entry.mediaType === 'tv') return `/watch/${entry.id}/${entry.season || 1}/${entry.episode || 1}`;
  return `/watch/${mediaId(entry.id)}`;
}

function HistoryCard({ entry, onRemove }: { entry: ProgressEntry; onRemove: (entry: ProgressEntry) => void }) {
  const progress =
    entry.duration > 0 ? Math.min(100, Math.max(0, Math.round((entry.timestamp / entry.duration) * 100))) : 0;
  const remaining = formatRemaining(entry);
  const label =
    entry.mediaType === 'tv'
      ? `Season ${entry.season || 1} • Episode ${entry.episode || 1}`
      : entry.mediaType === 'anime'
        ? `Episode ${entry.episode || 1}`
        : 'Movie';
  const url = watchUrl(entry);

  return (
    <div
      data-testid={entry.completed ? 'history-item-completed' : 'history-item-inprogress'}
      className="group flex flex-col rounded-xl bg-zinc-950/80 border border-zinc-850 hover:border-zinc-750 transition-all overflow-hidden shadow-sm"
    >
      <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden">
        {entry.poster ? (
          <img
            src={entry.poster}
            alt={entry.title || 'Poster'}
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              entry.completed ? 'opacity-80' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600">
            <Tv className="w-8 h-8 opacity-40" />
          </div>
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-black/85 text-[9px] font-mono font-bold text-zinc-300 uppercase border border-white/10 shadow-sm">
            {label}
          </span>
          {entry.completed && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold border border-emerald-500/30">
              <Check className="w-2.5 h-2.5" />
              <span>Watched</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onRemove(entry)}
          title="Remove from history"
          aria-label="Remove from history"
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-black text-zinc-400 hover:text-red-400 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {!entry.completed && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-950/80">
            <div className="h-full bg-rose-500" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1">
          <h3 className="text-xs sm:text-sm font-bold text-zinc-200 group-hover:text-white transition-colors truncate">
            {entry.title || 'Untitled'}
          </h3>
          {!entry.completed && (
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Resumed {formatTime(entry.timestamp)}</span>
              {remaining && <span>{remaining}</span>}
            </div>
          )}
        </div>

        <div className="pt-1 flex items-center gap-2">
          <Link
            to={url}
            className={`flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs transition-all shadow-sm active:scale-95 ${
              entry.completed
                ? 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 hover:text-white font-semibold'
                : 'bg-white hover:bg-zinc-200 text-black font-bold'
            }`}
          >
            {entry.completed ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-black" />}
            <span>{entry.completed ? 'Watch Again' : 'Resume'}</span>
          </Link>
          <button
            type="button"
            onClick={() => onRemove(entry)}
            title="Delete entry"
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer sm:hidden"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
