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
 * The frame is loaded by the VISITOR's browser, so the video request carries
 * the visitor's own IP, not ours. That matters: every public instance answers
 * a datacenter egress (a CI runner, a Vercel Function, this dev box) with an
 * anti-bot challenge, so the embed looks broken from anywhere but a real
 * browser. A visitor on a home connection is not challenged. Do not "fix" a
 * trailer by testing it from a server; test it in a browser.
 *
 * Because the frame is cross-origin, the parent CANNOT see whether it loaded:
 * `onError` never fires for a cross-origin iframe, and a challenge page is a
 * successful load as far as the DOM is concerned. So failure cannot be
 * detected and rotated automatically — instead the viewer is given a control
 * to try the next instance themselves. That is the honest design: we cannot
 * know it failed, so we do not pretend to.
 */

/**
 * Invidious hosts, tried in order.
 *
 * Taken from the project's own instance list (`api.invidious.io/instances.json`)
 * rather than a hand-picked pair, so a host that is retired or has lost its
 * certificate does not linger here. Ordered by how reliably each one has
 * answered: the leader has the weakest bot protection and served a real player
 * even from a challenged IP, and the rest follow by reported uptime.
 *
 * The project's own `invidious.io`, `api.invidious.io` and
 * `redirect.invidious.io` are deliberately NOT in this list — they are the
 * website, the API endpoint and an instance-chooser, not video hosts, and
 * pointing an embed at them yields a picker page rather than a player.
 *
 * `NEXT_PUBLIC_INVIDIOUS_HOST` overrides the list entirely (comma-separated)
 * so a self-hosted instance can be dropped in without a code change.
 */
const DEFAULT_HOSTS = [
  'https://invidious.tiekoetter.com',
  'https://inv.nadeko.net',
  'https://yt.chocolatemoo53.com',
  'https://invidious.f5.si',
  'https://invidious.nerdvpn.de',
  'https://yewtu.be',
];

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
  const hostLabel = host.replace(/^https?:\/\//, '');

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
                  className="absolute inset-0 h-full w-full"
                />
              </div>
              {/* No `onError` here on purpose: it never fires for a cross-origin
                  iframe, so it would be dead code pretending to be a fallback.
                  A challenge page also loads "successfully", so there is nothing
                  to observe. The viewer rotates instead — they are the only one
                  who can see that the frame is blank. */}
              <div className="mt-3 flex items-center justify-center gap-3 text-sm text-white/70">
                <span>{hostLabel}</span>
                {hosts.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setHostIndex((i) => (i + 1) % hosts.length)
                    }
                    className="glass-btn glass-btn-sm"
                  >
                    {t('tryAnotherSource')}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
