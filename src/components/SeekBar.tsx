import { useCallback, useEffect, useRef, useState } from 'react';

export interface SeekBarProps {
  /** Playback position in seconds. */
  current: number;
  /** Total duration in seconds. */
  duration: number;
  /** Buffered time ranges, as [start, end] pairs, in seconds. */
  buffered: Array<[number, number]>;
  /** Called continuously while dragging, for the preview timestamp. */
  onScrub?: (seconds: number | null) => void;
  /** Called once on release (or on click) with the target position. */
  onSeek: (seconds: number) => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Netflix-style seek bar.
 *
 * A native `<input type="range">` cannot render the buffered ranges: it is a
 * single-value control, so a seek bar built on one can only ever show the
 * played fraction. The white "buffered ahead" bar is the whole point of the
 * reference's progress display, so this draws the track explicitly and layers
 * three spans over it.
 *
 * Rendered as a div rather than an input, so keyboard seeking is provided
 * explicitly below.
 */
export default function SeekBar({ current, duration, buffered, onScrub, onSeek }: SeekBarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const dragRef = useRef<number | null>(null);

  const safeDuration = duration > 0 ? duration : 0;
  const displayValue = dragValue ?? current;
  const playedPercent = safeDuration > 0 ? clamp((displayValue / safeDuration) * 100, 0, 100) : 0;

  const positionFromEvent = useCallback(
    (clientX: number): number | null => {
      const track = trackRef.current;
      if (!track || safeDuration <= 0) return null;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return null;
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      return ratio * safeDuration;
    },
    [safeDuration]
  );

  const beginDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = positionFromEvent(event.clientX);
      if (target === null) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = target;
      setDragValue(target);
      onScrub?.(target);
    },
    [onScrub, positionFromEvent]
  );

  const moveDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Read the drag position from a ref rather than from state. Pointer
      // moves arrive faster than React re-renders, so a state-based guard
      // drops every sample between two renders — which is what made a fast
      // drag across the bar land nowhere near where the pointer stopped.
      if (dragRef.current === null) return;
      const target = positionFromEvent(event.clientX);
      if (target === null) return;
      dragRef.current = target;
      setDragValue(target);
      onScrub?.(target);
    },
    [onScrub, positionFromEvent]
  );

  // The commit is owned by a window-level listener rather than by the track's
  // own `pointerup`. A release can land anywhere once the pointer has left the
  // 20px track, and having both handlers commit would fire `onSeek` twice for
  // a single gesture.
  useEffect(() => {
    if (dragValue === null) return;
    const onUp = () => {
      const value = dragRef.current;
      if (value === null) return;
      // The side effects live here, not inside a `setState` updater: an
      // updater must be pure, and calling `onSeek` from one re-enters the
      // parent's render and trips React's update-depth guard.
      dragRef.current = null;
      setDragValue(null);
      onScrub?.(null);
      onSeek(value);
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragValue, onScrub, onSeek]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (safeDuration <= 0) return;
    const step = event.shiftKey ? 30 : 5;
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = current + step;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = current - step;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = safeDuration;
    if (next === null) return;
    event.preventDefault();
    onSeek(clamp(next, 0, safeDuration));
  };

  const hoverPercent =
    hoverValue !== null && safeDuration > 0 ? clamp((hoverValue / safeDuration) * 100, 0, 100) : null;

  return (
    <div
      ref={trackRef}
      data-testid="seek-bar"
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(safeDuration)}
      aria-valuenow={Math.round(displayValue)}
      aria-valuetext={`${Math.floor(displayValue / 60)} of ${Math.floor(safeDuration / 60)} minutes`}
      onKeyDown={onKeyDown}
      onPointerDown={beginDrag}
      onPointerMove={(event) => {
        moveDrag(event);
        const value = positionFromEvent(event.clientX);
        if (value !== null) {
          setHoverValue(value);
          const rect = trackRef.current?.getBoundingClientRect();
          if (rect) setHoverX(clamp(event.clientX - rect.left, 0, rect.width));
        }
      }}
      onPointerLeave={() => setHoverValue(null)}
      className="group/seek relative w-full py-2 cursor-pointer touch-none focus-visible:outline-none"
    >
      {/* The visual track is 4px, but the interactive area is padded out to
          ~20px: a 4px drag target is far too small to grab reliably with a
          finger or an imprecise mouse. All pointer handlers live on this
          padded wrapper, and positions are measured against it, so the
          padding is invisible but fully live. */}
      <div className="relative w-full h-1 rounded-full bg-white/20 group-focus-visible/seek:ring-2 group-focus-visible/seek:ring-white/60">
        {/* Buffered ranges — the white bar. Rendered per range because a
            stream can buffer in several disjoint chunks, and a single
            min→max span would claim the gaps are cached when they are not. */}
        {safeDuration > 0 &&
          buffered.map(([start, end], index) => {
            const left = clamp((start / safeDuration) * 100, 0, 100);
            const width = clamp(((end - start) / safeDuration) * 100, 0, 100 - left);
            if (width <= 0) return null;
            return (
              <span
                key={`${start}-${end}-${index}`}
                data-testid="seek-buffered"
                className="absolute top-0 bottom-0 rounded-full bg-white/70 pointer-events-none"
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            );
          })}

        {/* Played fraction. */}
        <span
          data-testid="seek-played"
          className="absolute top-0 bottom-0 left-0 rounded-full bg-rose-500 pointer-events-none"
          style={{ width: `${playedPercent}%` }}
        />

        {/* Hover preview — a faint segment showing where a click would land. */}
        {hoverPercent !== null && (
          <span
            className="absolute top-0 bottom-0 rounded-full bg-white/30 pointer-events-none"
            style={{ width: `${hoverPercent}%` }}
          />
        )}

        {/* Thumb, scaling in on hover to match the reference. */}
        <span
          data-testid="seek-thumb"
          className="absolute top-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-rose-500 pointer-events-none scale-0 group-hover/seek:scale-100 transition-transform"
          style={{ left: `${playedPercent}%` }}
        />

        {/* Time bubble while scrubbing. */}
        {dragValue !== null && (
          <span
            className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 border border-white/20 text-[11px] font-mono text-white tabular-nums pointer-events-none whitespace-nowrap"
            style={{ left: `${playedPercent}%` }}
          >
            {formatClock(dragValue)}
          </span>
        )}

        {hoverValue !== null && dragValue === null && (
          <span
            className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-black/80 border border-white/10 text-[11px] font-mono text-zinc-200 tabular-nums pointer-events-none whitespace-nowrap"
            style={{ left: `${hoverX}px` }}
          >
            {formatClock(hoverValue)}
          </span>
        )}
      </div>
    </div>
  );
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}
