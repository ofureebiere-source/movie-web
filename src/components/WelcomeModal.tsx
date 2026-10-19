import { useEffect, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { APP_RELEASES_URL, BADGE_INITIALS, SITE_NAME, WORDMARK_ACCENT, WORDMARK_LEAD } from '@/lib/brand';

/**
 * The first-visit welcome modal.
 *
 * Ported 1:1 from frameXTV.xyz's welcome dialog: shown once, dismissed into
 * `localStorage`, closable by Escape / backdrop / the X. The reference's
 * support and social buttons are replaced by a single link to the Netflix-pro
 * app releases, matching where this product is distributed.
 */

const SEEN_KEY = 'netflixpro_welcome_seen';

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(SEEN_KEY) !== 'true');
    } catch {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, 'true');
    } catch {
      /* disabled */
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      data-testid="welcome-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={close}
    >
      <div
        className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-5 sm:p-6 text-center overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close welcome modal"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mx-auto w-11 h-11 rounded-xl bg-white text-black font-black font-mono text-base flex items-center justify-center shadow border border-zinc-200 mb-3">
          {BADGE_INITIALS}
        </div>

        <h2 id="welcome-modal-title" className="text-xl font-bold text-white tracking-tight">
          Welcome to{' '}
          <span className="font-mono">
            {WORDMARK_LEAD}
            <span className="text-zinc-400">{WORDMARK_ACCENT}</span>
          </span>
        </h2>
        <p className="text-xs sm:text-sm font-medium text-zinc-300 mt-1">Thanks for choosing our platform!</p>
        <p className="text-xs text-zinc-400 leading-relaxed mt-2 max-w-xs mx-auto">
          Decrypted HD streaming for movies, TV series, and anime with zero friction.
        </p>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            data-testid="welcome-continue-btn"
            onClick={close}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer group active:scale-[0.99]"
          >
            <span>Continue to site</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <a
            href={APP_RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="welcome-app-btn"
            onClick={close}
            className="w-full py-2 px-3 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title={`Get the ${SITE_NAME} app`}
          >
            <span>Get the {SITE_NAME} app</span>
          </a>
        </div>

        <p className="text-[11px] text-zinc-500 italic mt-4 font-sans tracking-tight">
          Decrypted HD streaming for movies, TV series, and anime.
        </p>
      </div>
    </div>
  );
}
