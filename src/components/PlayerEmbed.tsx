import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Play, RotateCcw, Server, X } from 'lucide-react';
import { formatTime } from '@/lib/watchProgress';
import type { PlayerView } from '@/lib/viewOrientation';

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
  /**
   * Called when the frame fails to reach a playable state. When supplied, the
   * embed does not show its own dead-end overlay: the owner is expected to move
   * to another server and hand back a fresh `embedUrl`. The error overlay only
   * appears once the owner reports that every server has been tried.
   */
  onFailure?: (reason: 'error' | 'timeout') => void;
  /** Shown instead of the error overlay when `onFailure` owns recovery. */
  failoverNotice?: string | null;
  /** True when the owner has exhausted every server and wants the overlay. */
  showErrorOverlay?: boolean;
  /**
   * Called when the viewer asks to try again. The owner re-arms its failover
   * budget and forces a fresh stream resolution; the frame does not retry the
   * same dead source on its own.
   */
  onRetry?: () => void;
}

/**
 * How long to wait for `frameXTV:ready` before treating the frame as failed.
 *
 * `ready` is announced by the player document itself (on mount and on first
 * play), not by the iframe's `load` event: an iframe pointed at a dead stream
 * still fires `load` for its error page, so `load` proves nothing. This window
 * is therefore the only backstop for a frame that never announces itself.
 */
const READY_TIMEOUT_MS = 15000;

const PlayerEmbed = forwardRef<PlayerEmbedHandle, PlayerEmbedProps>(function PlayerEmbed(
  {
    embedUrl,
    title,
    posterUrl,
    backUrl = '/',
    resumedTime = 0,
    onTimeUpdate,
    onPlayerReady,
    onAutoplayChange,
    onFailure,
    failoverNotice = null,
    showErrorOverlay = false,
    onRetry,
  },
  ref
) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // The player reports its orientation over the postMessage bridge; the frame's
  // box follows it, because an iframe cannot be sized by its content.
  const [frameView, setFrameView] = useState<PlayerView>('landscape');
  const [showResume, setShowResume] = useState(resumedTime > 15);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Guards against reporting the same frame twice: a frame that errors and then
  // also times out must only advance the server once.
  const reportedRef = useRef(false);

  useEffect(() => {
    setReady(false);
    setFailed(false);
    setShowResume(resumedTime > 15);
    reportedRef.current = false;
  }, [embedUrl, resumedTime]);

  const reportFailure = useCallback(
    (reason: 'error' | 'timeout') => {
      if (reportedRef.current) return;
      reportedRef.current = true;
      if (onFailure) {
        // The owner will swap the server and re-render with a new URL; leaving
        // `failed` unset keeps the initialising overlay up during the hop
        // rather than flashing a dead end.
        onFailure(reason);
      } else {
        setFailed(true);
      }
    },
    [onFailure]
  );

  // An iframe that points at a dead server frequently loads *something* (an
  // error page) and never fires `onError`, so silence is the only reliable
  // signal. If the embed never announces itself, treat the server as failed.
  useEffect(() => {
    if (ready) return;
    if (!onFailure) return;
    const timer = window.setTimeout(() => {
      if (!reportedRef.current) reportFailure('timeout');
    }, READY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [ready, onFailure, reportFailure, embedUrl]);

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
      if (data.event === 'frameXTV:view') {
        const { view } = data as { view?: string };
        if (view === 'portrait' || view === 'landscape') setFrameView(view);
      }
      // The embedded player reports a dead end only after it has itself tried
      // every source it holds. A host that owns more servers (the provider bar)
      // takes over here rather than letting the frame show an error.
      if (data.event === 'frameXTV:error') {
        reportFailure('error');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onTimeUpdate, onPlayerReady, onAutoplayChange, reportFailure]);

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

      {/* The frame's document fills this box, so the box has to take the shape
          the player asks for: the player reports its orientation over the
          postMessage bridge and this box follows it. Landscape is unchanged
          from before the toggle existed. */}
      <div
        className={`relative w-full bg-black sm:rounded-2xl overflow-hidden border-y sm:border border-zinc-850 shadow-2xl ${
          frameView === 'portrait' ? 'h-[80vh]' : 'aspect-video'
        }`}
      >
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

        {/* A silent automatic hop between servers. Shown in place of the error
            overlay so a dead server never reaches the viewer as a failure. */}
        {failoverNotice && !failed && (
          <div
            role="status"
            aria-live="polite"
            data-testid="embed-failover-notice"
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/85 backdrop-blur-md border border-white/15 text-[11px] font-mono text-zinc-200 shadow-2xl animate-fade-in"
          >
            <span className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin" />
            {failoverNotice}
          </div>
        )}

        {(failed || showErrorOverlay) && (
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
                  if (onRetry) {
                    onRetry();
                    return;
                  }
                  setFailed(false);
                  setReady(false);
                  reportedRef.current = false;
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
          onError={() => reportFailure('error')}
          key={`${embedUrl}-${reloadKey}`}
        />
      </div>
    </div>
  );
});

export default PlayerEmbed;
