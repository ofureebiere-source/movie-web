import { useEffect, useRef, useState } from 'react';
import { Check, ImageOff, Play, Sparkles, Timer, X } from 'lucide-react';
import type { FxEpisode, FxSeason } from '@/lib/api';
import { isNotFoundPath } from '@/lib/notFound';

/**
 * The episode picker.
 *
 * Ported 1:1 from frameXTV.xyz's `EpisodeDrawer` (the `_e` component in its
 * `WatchPage` chunk): a season pill row, a 25-episode page row for anime, and
 * either a thumbnail list (series) or a numbered grid (anime). Episodes whose
 * watch URL is on the reference's known-404 list render disabled, and the
 * active season / episode page is scrolled into view when the drawer opens.
 */

const PAGE_SIZE = 25;

function buildWatchUrl(tvId: string, season: number, episode: number): string {
  return `/watch/${tvId}/${season}/${episode}`;
}

export default function EpisodeDrawer({
  isOpen,
  onClose,
  mediaType,
  title,
  tvId,
  seasons = [],
  activeSeason = 1,
  episodes = [],
  isLoadingEpisodes = false,
  onSelectSeason,
  totalEpisodes = 1,
  currentSeason,
  currentEpisode,
  onSelectEpisode,
}: {
  isOpen: boolean;
  onClose: () => void;
  mediaType: 'tv' | 'anime';
  title: string;
  tvId?: string;
  seasons?: FxSeason[];
  activeSeason?: number;
  episodes?: FxEpisode[];
  isLoadingEpisodes?: boolean;
  onSelectSeason?: (season: number) => void;
  totalEpisodes?: number;
  currentSeason?: number;
  currentEpisode: number;
  onSelectEpisode: (season: number, episode: number) => void;
}) {
  const totalPages = Math.ceil(totalEpisodes / PAGE_SIZE);
  const initialPage = Math.floor((Math.max(1, currentEpisode) - 1) / PAGE_SIZE);
  const [page, setPage] = useState(initialPage);
  const seasonTrackRef = useRef<HTMLDivElement | null>(null);
  const pageTrackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && seasonTrackRef.current) {
      const active = seasonTrackRef.current.querySelector('[data-active="true"]');
      active?.scrollIntoView({ inline: 'nearest', behavior: 'smooth', block: 'nearest' });
    }
  }, [isOpen, activeSeason]);

  useEffect(() => {
    if (isOpen && pageTrackRef.current) {
      const active = pageTrackRef.current.querySelector('[data-active="true"]');
      active?.scrollIntoView({ inline: 'nearest', behavior: 'smooth', block: 'nearest' });
    }
  }, [isOpen, page]);

  useEffect(() => {
    setPage(Math.floor((Math.max(1, currentEpisode) - 1) / PAGE_SIZE));
  }, [currentEpisode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const numbered = seasons.filter((season) => season.number > 0);
  const shown = numbered.length > 0 ? numbered : seasons;
  const first = page * PAGE_SIZE + 1;
  const last = Math.min((page + 1) * PAGE_SIZE, totalEpisodes);
  const pageEpisodes: number[] = [];
  for (let index = first; index <= last; index += 1) pageEpisodes.push(index);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select Episode"
        data-testid="episode-drawer"
        className="relative z-10 w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col bg-zinc-950 border-t sm:border border-white/[0.08] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-scale-up"
      >
        <div className="w-10 h-1 rounded-full bg-zinc-700/80 mx-auto mt-2.5 sm:hidden shrink-0" />

        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06] bg-zinc-900/50 flex-shrink-0">
          <div className="space-y-0.5 min-w-0 pr-4">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">{title}</h2>
            <p className="text-[11px] font-mono text-zinc-400">
              {mediaType === 'tv'
                ? `Season ${activeSeason} • Select an Episode`
                : shown.length > 1
                  ? `Season ${activeSeason} of ${shown.length} • ${totalEpisodes} Episodes Total`
                  : `${totalEpisodes} Episodes Total • Select Episode`}
            </p>
          </div>
          <button
            type="button"
            data-testid="episode-drawer-close"
            onClick={onClose}
            className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/[0.06] text-zinc-400 hover:text-white transition-all active:scale-95 cursor-pointer"
            aria-label="Close episode selector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {(mediaType === 'tv' || mediaType === 'anime') && shown.length > 1 && (
          <div className="px-4 sm:px-6 py-2.5 border-b border-white/[0.05] bg-zinc-950/40 flex-shrink-0">
            <div ref={seasonTrackRef} className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
              {shown.map((season) => {
                const active = season.number === activeSeason;
                const count = season.episodeCount ?? season.episode_count ?? 0;
                return (
                  <button
                    key={season.id ?? season.number}
                    type="button"
                    data-active={active ? 'true' : 'false'}
                    onClick={() => onSelectSeason?.(season.number)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? mediaType === 'anime'
                          ? 'bg-rose-500 text-white font-bold shadow-sm shadow-rose-500/20'
                          : 'bg-white text-black font-bold shadow-sm'
                        : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/[0.06]'
                    }`}
                  >
                    <span>{season.name || `Season ${season.number}`}</span>
                    {count > 0 && (
                      <span
                        className={`ml-1 text-[10px] font-mono ${
                          active
                            ? mediaType === 'anime'
                              ? 'text-rose-200'
                              : 'text-zinc-600'
                            : 'text-zinc-500'
                        }`}
                      >
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mediaType === 'anime' && totalPages > 1 && (
          <div className="px-4 sm:px-6 py-2.5 border-b border-white/[0.05] bg-zinc-950/40 flex-shrink-0">
            <div ref={pageTrackRef} className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
              {Array.from({ length: totalPages }, (_, index) => {
                const start = index * PAGE_SIZE + 1;
                const end = Math.min((index + 1) * PAGE_SIZE, totalEpisodes);
                const active = index === page;
                return (
                  <button
                    key={index}
                    type="button"
                    data-active={active ? 'true' : 'false'}
                    onClick={() => setPage(index)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer ${
                      active
                        ? 'bg-rose-500 text-white font-bold'
                        : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-white/[0.06]'
                    }`}
                  >
                    {start}–{end}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          {mediaType === 'tv' ? (
            isLoadingEpisodes ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((key) => (
                  <div key={key} className="h-20 rounded-xl bg-zinc-900/50 border border-white/[0.05] animate-pulse" />
                ))}
              </div>
            ) : episodes.length === 0 ? (
              <div className="p-8 rounded-xl bg-zinc-900/30 border border-white/[0.05] text-center text-zinc-500 text-xs font-mono">
                No episode details available for Season {activeSeason}.
              </div>
            ) : (
              <div className="space-y-2">
                {episodes.map((entry) => {
                  const active = entry.number === currentEpisode;
                  const blocked = Boolean(tvId) && isNotFoundPath(buildWatchUrl(tvId as string, activeSeason, entry.number));
                  return (
                    <button
                      key={entry.id ?? entry.number}
                      type="button"
                      disabled={blocked}
                      onClick={() => {
                        if (blocked) return;
                        onSelectEpisode(activeSeason, entry.number);
                        onClose();
                      }}
                      className={`w-full group flex items-start gap-3 p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
                        blocked
                          ? 'bg-zinc-950/20 border-white/[0.03] opacity-50 cursor-not-allowed'
                          : active
                            ? 'bg-zinc-900 border-white/[0.15] shadow-md ring-1 ring-white/10 cursor-pointer'
                            : 'bg-zinc-950/40 hover:bg-zinc-900/60 border-white/[0.05] hover:border-white/[0.1] cursor-pointer'
                      }`}
                    >
                      <div className="relative flex-shrink-0 w-24 sm:w-28 aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-white/[0.06] flex items-center justify-center">
                        {entry.still ? (
                          <img
                            src={entry.still}
                            alt=""
                            loading="lazy"
                            className={`w-full h-full object-cover transition-transform duration-300 ${
                              blocked ? 'grayscale opacity-40' : 'group-hover:scale-105'
                            }`}
                          />
                        ) : (
                          <ImageOff className="w-5 h-5 text-zinc-600" />
                        )}
                        <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[9px] font-mono font-bold text-white">
                          {blocked ? 'UNAVAILABLE' : `EP ${entry.number}`}
                        </div>
                        {active && !blocked && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Play className="w-4 h-4 fill-white text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4
                            className={`text-xs sm:text-sm font-semibold truncate ${
                              active ? 'text-white' : 'text-zinc-200 group-hover:text-white'
                            }`}
                          >
                            {entry.number}. {entry.name || `Episode ${entry.number}`}
                          </h4>
                          {active && (
                            <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-wider">
                              Now Playing
                            </span>
                          )}
                        </div>
                        {entry.runtime ? (
                          <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-500">
                            <Timer className="w-3 h-3 text-zinc-500" />
                            <span>{entry.runtime}m</span>
                          </div>
                        ) : null}
                        {entry.overview && (
                          <p className="text-xs text-zinc-400 line-clamp-1 leading-relaxed">{entry.overview}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : totalEpisodes <= 0 ? (
            <div className="p-8 rounded-xl bg-zinc-900/30 border border-white/[0.05] text-center text-zinc-500 text-xs font-mono">
              No episodes aired yet for Season {activeSeason}.
            </div>
          ) : (
            <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {pageEpisodes.map((number) => {
                const active = (!currentSeason || activeSeason === currentSeason) && number === currentEpisode;
                return (
                  <button
                    key={number}
                    type="button"
                    onClick={() => {
                      onSelectEpisode(activeSeason, number);
                      onClose();
                    }}
                    className={`group flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer active:scale-95 text-center select-none ${
                      active
                        ? 'bg-rose-500 border-rose-400 text-white font-bold shadow-md shadow-rose-500/20'
                        : 'bg-zinc-900/80 hover:bg-zinc-850 border-white/[0.06] hover:border-white/[0.12] text-zinc-300 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-mono font-semibold">EP {number}</span>
                    {active ? (
                      <Check className="w-3.5 h-3.5 text-white mt-1" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-zinc-500 group-hover:text-rose-400 transition-colors mt-1" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
