import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Play, RotateCcw, Server, X } from 'lucide-react';
import { formatTime } from '@/lib/watchProgress';

/**
 * The player frame, and the `postMessage` bridge around it.
 *
 * Ported 1:1 from frameXTV.xyz's `PlayerEmbed` (the `he` component in its
 * `WatchPage` chunk). The watch page never mounts the player directly: it
 * renders this component, which owns an `<iframe>` pointed at the site's own
 * `/embed/*` route, so playback lives in a separate document exactly as it does
 * upstream. The bridge receives `frameXTV:ready`, `frameXTV:timeupdate` and
 * `frameXTV:autoplay_preference` from the embed, and can drive it back with
 * `{ action: 'seek' | 'play' }` for the resume prompt's restart control.
 *
 * Also ported: the dismissible "switch server" tip above the frame, the
 * initialising overlay, the load-failure overlay, and the "Resumed at …"
 * chip with its Start-from-beginning button.
 */

export interface PlayerEmbedHandle {
  restart: () => void;
}

export interface PlayerEmbedProps {
  embedUrl: string;
  title: string;
  posterUrl?: string;
  backUrl?: string;
  resumedTime?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlayerReady?: () => void;
  onAutoplayChange?: (enabled: boolean) => void;
}

const PlayerEmbed = forwardRef<PlayerEmbedHandle, PlayerEmbedProps>(function PlayerEmbed(
  { embedUrl, title, posterUrl, backUrl = '/', resumedTime = 0, onTimeUpdate, onPlayerReady, onAutoplayChange },
  ref
) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showResume, setShowResume] = useState(resumedTime > 15);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setReady(false);
    setFailed(false);
    setShowResume(resumedTime > 15);
  }, [embedUrl, resumedTime]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== 'object') return;
      if (data.event === 'frameXTV:ready') {
        setReady(true);
        onPlayerReady?.();
      }
      if (data.event === 'frameXTV:timeupdate') {
        const { currentTime, duration } = data as { currentTime?: number; duration?: number };
        if (typeof currentTime === 'number' && typeof duration === 'number') onTimeUpdate?.(currentTime, duration);
      }
      if (data.event === 'frameXTV:autoplay_preference') {
        const { enabled } = data as { enabled?: boolean };
        if (typeof enabled === 'boolean') onAutoplayChange?.(enabled);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onTimeUpdate, onPlayerReady, onAutoplayChange]);

  const restart = () => {
    try {
      frameRef.current?.contentWindow?.postMessage({ action: 'seek', time: 0 }, '*');
      frameRef.current?.contentWindow?.postMessage({ action: 'play' }, '*');
    } catch {
      setReloadKey((value) => value + 1);
    }
    setShowResume(false);
  };

  useImperativeHandle(ref, () => ({ restart }));

  return (
    <div className="w-full mx-auto space-y-2 sm:space-y-2.5">
      {!tipDismissed && (
        <aside
          role="note"
          aria-label="Playback server tip"
          data-testid="player-server-banner"
          className="mx-2 sm:mx-0 px-3 sm:px-4 py-2 rounded-xl bg-zinc-900/90 border border-amber-500/20 backdrop-blur-md shadow-lg shadow-black/20 flex items-center justify-between gap-2.5 text-xs text-zinc-300 animate-fade-in"
        >
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="relative flex items-center justify-center shrink-0">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </div>
            <Server className="w-3.5 h-3.5 text-amber-400/90 shrink-0 hidden sm:block" />
            <p className="leading-snug sm:leading-normal">
              <span className="font-semibold text-zinc-100">Buffering or not loading?</span>{' '}
              <span className="text-zinc-400">Switch server via top-right server name in player.</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTipDismissed(true)}
            className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center -mr-1 text-zinc-400 hover:text-white rounded-lg transition-colors shrink-0 cursor-pointer"
            title="Dismiss tip"
            aria-label="Dismiss tip"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </aside>
      )}

      <div className="relative w-full aspect-video bg-black sm:rounded-2xl overflow-hidden border-y sm:border border-zinc-850 shadow-2xl">
        {!ready && !failed && (
          <div className="absolute inset-0 z-10 bg-zinc-950 flex flex-col items-center justify-center p-6 select-none animate-fade-in">
            {posterUrl && (
              <img src={posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15 blur-sm scale-105" />
            )}
            <div className="relative z-10 flex flex-col items-center space-y-4">
              <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-white animate-spin" />
              <div className="text-center space-y-1">
                <p className="text-xs sm:text-sm font-semibold text-zinc-200 tracking-wide">Initializing Playback Stream</p>
                <p className="text-[11px] font-mono text-zinc-500">Negotiating ultra-low latency connection...</p>
              </div>
            </div>
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 z-20 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="text-sm sm:text-base font-bold text-white">Unable to load this episode</h3>
              <p className="text-xs text-zinc-400">
                The stream could not be loaded or the playback server is temporarily unavailable.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setFailed(false);
                  setReady(false);
                  setReloadKey((value) => value + 1);
                }}
                className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
              >
                Try Again
              </button>
              <Link
                to={backUrl}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to details</span>
              </Link>
            </div>
          </div>
        )}

        {showResume && ready && !failed && (
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-950/90 border border-zinc-700/80 backdrop-blur-md shadow-xl text-xs font-mono text-zinc-200 animate-fade-in">
            <Play className="w-3 h-3 fill-zinc-300 text-zinc-300" />
            <span>Resumed at {formatTime(resumedTime)}</span>
            <span className="text-zinc-600">•</span>
            <button
              type="button"
              onClick={restart}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-white hover:text-rose-400 transition-colors cursor-pointer underline underline-offset-2"
              title="Restart from 0:00"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Start from beginning</span>
            </button>
            <button
              type="button"
              onClick={() => setShowResume(false)}
              className="ml-1 text-zinc-500 hover:text-zinc-300 text-xs px-1 cursor-pointer"
              aria-label="Dismiss resume prompt"
            >
              ×
            </button>
          </div>
        )}

        <iframe
          ref={frameRef}
          data-testid="player-iframe"
          src={embedUrl}
          title={title}
          className="w-full h-full border-0 bg-black"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; display-capture; presentation"
          allowFullScreen
          onLoad={() => setReady(true)}
          onError={() => setFailed(true)}
          key={`${embedUrl}-${reloadKey}`}
        />
      </div>
    </div>
  );
});

export default PlayerEmbed;
