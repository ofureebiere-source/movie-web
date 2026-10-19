'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaPlay, FaTimes } from 'react-icons/fa';
import { useTranslations } from 'next-intl';

/**
 * A title's trailer, played through a privacy front-end.
 *
 * The catalogue hands us a bare YouTube id, but the embed is NOT pointed at
 * youtube.com: the frame is served by an Invidious instance instead. That
 * keeps the third party off the page — no YouTube cookies, no Google
 * tracking, no branded chrome on a page that is meant to be our own — and it
 * is why the id is stored rather than a full URL.
 *
 * The instance is configurable because public Invidious hosts come and go and
 * several sit behind an anti-bot challenge that only a real browser clears.
 * The frame is loaded by the VISITOR's browser, so a challenge that blocks our
 * build or our datacenter does not block them. When a host is down the frame
 * simply fails to paint; the trailer is decorative, so that degrades to
 * nothing rather than to an error the viewer has to deal with.
 */

/**
 * Invidious hosts, tried in order. The first is the one the front-end has been
 * most reliable on; `NEXT_PUBLIC_INVIDIOUS_HOST` overrides the list entirely
 * so a self-hosted instance can be dropped in without a code change.
 */
const DEFAULT_HOSTS = ['https://yewtu.be', 'https://invidious.f5.si'];

function invidiousHosts(): string[] {
  const configured = process.env.NEXT_PUBLIC_INVIDIOUS_HOST;
  if (configured) {
    return configured
      .split(',')
      .map((h) => h.trim().replace(/\/+$/, ''))
      .filter(Boolean);
  }
  return DEFAULT_HOSTS;
}

export default function Trailer({ trailerKey }: { trailerKey: string }) {
  const t = useTranslations('movie');
  const [open, setOpen] = useState(false);
  const [hostIndex, setHostIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const hosts = invidiousHosts();

  // The lightbox is portalled to `document.body`, which only exists client
  // side. Deferring to an effect keeps the first render identical on the
  // server and the client.
  useEffect(() => setMounted(true), []);

  const close = useCallback(() => setOpen(false), []);

  // Escape closes, and the page must not scroll behind the overlay.
  useEffect(() => {
    if (!open) return;
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
  }, [open, close]);

  if (!trailerKey) return null;

  const host = hosts[Math.min(hostIndex, hosts.length - 1)];
  const embedUrl = `${host}/embed/${encodeURIComponent(trailerKey)}?autoplay=1&local=1`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass-btn glass-btn-secondary"
      >
        <FaPlay size={16} />
        <span>{t('trailer')}</span>
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={t('trailer')}
            onClick={close}
          >
            <div
              className="relative w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={close}
                aria-label={t('closeTrailer')}
                className="absolute -top-10 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/90 backdrop-blur-md ring-1 ring-white/20 transition hover:bg-white/20 hover:text-white"
              >
                <FaTimes size={14} />
              </button>
              <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-black">
                <iframe
                  // Keyed on the host so switching instances remounts the
                  // frame instead of leaving the failed one in place.
                  key={host}
                  src={embedUrl}
                  title={t('trailer')}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  onError={() => setHostIndex((i) => (i + 1 < hosts.length ? i + 1 : i))}
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
