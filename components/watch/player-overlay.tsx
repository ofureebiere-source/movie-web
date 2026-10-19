'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { FaTimes } from 'react-icons/fa';
import { useTranslations } from 'next-intl';
import MovieWatchPage from './index';
import type DetailMovie from 'types/detail-movie';
import { tmdbBackdropLoader } from 'lib/tmdb-image';

/**
 * Full-screen playback over the page the viewer is already on.
 *
 * The home carousel's "Watch now" must start the film without navigating, so
 * the watch surface is mounted here as an overlay instead of sending the
 * viewer to `/movies/watch/<slug>`. That route still exists for direct links;
 * this is the carousel's own entry point.
 *
 * The opening is a morph, not a cut: the title's backdrop fills the screen
 * first — the same image the hero was already showing, so it reads as the
 * poster growing rather than a new screen appearing — and the player fades up
 * underneath it while the backdrop fades away. A `prefers-reduced-motion`
 * viewer gets the end state immediately, with no cross-fade.
 *
 * The overlay owns scroll locking and Escape; the player itself is unchanged
 * and does not know it is inside a modal.
 */
export default function PlayerOverlay({
  movie,
  onClose,
}: {
  movie: DetailMovie;
  onClose: () => void;
}) {
  const t = useTranslations('watch');
  const [mounted, setMounted] = useState(false);
  // Starts opaque on the backdrop and flips once the frame is up, which is
  // what drives the cross-fade.
  const [revealed, setRevealed] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setRevealed(true);
      return;
    }
    // One frame on the backdrop, then hand over. Long enough to see the
    // poster, short enough that it never feels like a loading screen.
    const timer = setTimeout(() => setRevealed(true), 180);
    return () => clearTimeout(timer);
  }, []);

  const close = useCallback(() => closeRef.current(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [close]);

  if (!mounted) return null;

  const backdrop = movie.movie.tmdb_backdrop;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] overflow-y-auto bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={movie.movie.name}
    >
      {/* The morph layer: the hero's own backdrop, held over the player until
          the frame is ready, then faded out. Pointer-events off so it can
          never eat a click meant for the controls underneath. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-500 ease-out ${
          revealed ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {backdrop && (
          <Image
            src={backdrop}
            loader={tmdbBackdropLoader}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <button
        type="button"
        onClick={close}
        aria-label={t('closePlayer')}
        className="fixed right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/90 backdrop-blur-md ring-1 ring-white/20 transition hover:bg-white/20 hover:text-white"
      >
        <FaTimes size={15} />
      </button>

      <div className="relative z-20 pt-14 lg:pt-4">
        <MovieWatchPage movie={movie} playerOnly onClose={close} />
      </div>
    </div>,
    document.body
  );
}
