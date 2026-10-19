import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Clock, Film, Play, RotateCcw, Search, Trash2, Tv } from 'lucide-react';
import { clearAllProgress, formatTime, useWatchHistory } from '@/lib/watchProgress';
import { pageTitle } from '@/lib/brand';

/**
 * The watch history page.
 *
 * Ported 1:1 from frameXTV.xyz's `HistoryPage`: entries are grouped by date
 * bucket (Today / Yesterday / Earlier this week / Older), each row shows a
 * thumbnail, the episode label, the timestamp and a resume link, finished
 * titles are badged, and a Clear All button wipes the store.
 */

type Bucket = 'Today' | 'Yesterday' | 'Earlier this week' | 'Older';

function bucketOf(updatedAt: number): Bucket {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;
  if (updatedAt >= startOfToday) return 'Today';
  if (updatedAt >= startOfYesterday) return 'Yesterday';
  if (updatedAt >= startOfWeek) return 'Earlier this week';
  return 'Older';
}

const BUCKET_ORDER: Bucket[] = ['Today', 'Yesterday', 'Earlier this week', 'Older'];

export default function HistoryPage() {
  const { items, refresh } = useWatchHistory();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = pageTitle('Watch History');
  }, []);

  const groups = BUCKET_ORDER.map((bucket) => ({
    bucket,
    entries: items.filter((entry) => bucketOf(entry.updatedAt || 0) === bucket),
  })).filter((group) => group.entries.length > 0);

  const totalMinutes = Math.round(items.reduce((sum, entry) => sum + (entry.timestamp || 0), 0) / 60);

  return (
    <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.04] pb-5">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-white" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Watch History</h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            {items.length} title{items.length === 1 ? '' : 's'} tracked
            {items.length > 0 ? ` · ${totalMinutes} min watched` : ''}
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            data-testid="history-clear-all-btn"
            onClick={() => {
              clearAllProgress();
              refresh();
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/40 border border-zinc-800 hover:border-rose-900/50 text-zinc-300 hover:text-rose-400 text-xs font-medium transition-all cursor-pointer self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All History</span>
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div data-testid="history-empty-state" className="py-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Clock className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-white">No watch history yet</h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Movies, series, and anime you play will be tracked here so you can resume instantly.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Link
              to="/movies"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all"
            >
              <Film className="w-3.5 h-3.5" />
              <span>Browse Movies</span>
            </Link>
            <Link
              to="/search"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.bucket} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-200 tracking-tight">{group.bucket}</h2>
                <span className="text-[11px] font-mono text-zinc-400">{group.entries.length} entries</span>
              </div>

              <div className="space-y-2.5">
                {group.entries.map((entry) => {
                  const progress =
                    entry.duration > 0
                      ? Math.min(100, Math.max(0, Math.round((entry.timestamp / entry.duration) * 100)))
                      : 0;
                  const episodeLabel =
                    entry.mediaType === 'tv'
                      ? `S${entry.season || 1} · E${entry.episode || 1}`
                      : entry.mediaType === 'anime'
                        ? `Episode ${entry.episode || 1}`
                        : 'Movie';
                  const watchUrl =
                    entry.mediaType === 'anime'
                      ? `/watch/anime/${entry.id}/${entry.episode || 1}`
                      : entry.mediaType === 'tv'
                        ? `/watch/${entry.id}/${entry.season || 1}/${entry.episode || 1}`
                        : `/watch/${entry.id}`;
                  const detailUrl =
                    entry.mediaType === 'anime'
                      ? `/anime/${entry.id}`
                      : entry.mediaType === 'tv'
                        ? `/tv/${entry.id}`
                        : `/movie/${entry.id}`;

                  return (
                    <div
                      key={`${entry.mediaType}-${entry.id}-${entry.season || 1}-${entry.episode || 1}`}
                      data-testid="history-entry"
                      className="group flex flex-col sm:flex-row items-start gap-3 sm:gap-4 p-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-900/60 border border-zinc-850 hover:border-zinc-800 transition-all"
                    >
                      <Link
                        to={watchUrl}
                        className="relative flex-shrink-0 w-full sm:w-32 aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800"
                      >
                        {entry.poster ? (
                          <img
                            src={entry.poster}
                            alt={entry.title || 'Media poster'}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <Tv className="w-6 h-6 opacity-50" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shadow">
                            <Play className="w-3 h-3 fill-black ml-0.5" />
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-950/80">
                          <div className="h-full bg-rose-500" style={{ width: `${progress}%` }} />
                        </div>
                      </Link>

                      <div className="flex-1 min-w-0 space-y-1.5 w-full">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              to={detailUrl}
                              className="text-xs sm:text-sm font-bold text-zinc-200 hover:text-white transition-colors truncate block"
                            >
                              {entry.title || 'Untitled'}
                            </Link>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-400 pt-0.5">
                              <span>{episodeLabel}</span>
                              <span>•</span>
                              <span>{formatTime(entry.timestamp)} watched</span>
                              {entry.completed && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-400 font-semibold">Finished</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Link
                              to={watchUrl}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 min-h-[32px] rounded-md bg-white hover:bg-zinc-200 text-black text-[11px] font-bold transition-all active:scale-95"
                            >
                              {entry.completed ? <RotateCcw className="w-3 h-3" /> : <Play className="w-3 h-3 fill-black" />}
                              <span>{entry.completed ? 'Rewatch' : 'Resume'}</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
