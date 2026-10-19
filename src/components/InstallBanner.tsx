import { useEffect, useState } from 'react';
import { Download, Github, X } from 'lucide-react';
import { APP_DOWNLOAD_URL, APP_RELEASES_URL, SITE_NAME } from '@/lib/brand';

/**
 * The install banner.
 *
 * frameXTV.xyz's banner prompts the browser's PWA install flow. This product
 * ships a companion mobile app instead, so the same banner chrome (fixed
 * bottom-right card, dismiss stored for the session) now points at the
 * Netflix-pro app and downloads the APK directly from GitHub.
 */

const DISMISS_KEY = 'netflixpro_install_dismissed';

export default function InstallBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === 'true');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      /* disabled */
    }
  };

  return (
    <div
      data-testid="install-banner"
      className="glass-panel fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 sm:bottom-4 sm:left-auto sm:right-4 z-40 max-w-sm mx-auto sm:mx-0 bg-zinc-950/95 border border-zinc-800 backdrop-blur-md rounded-2xl p-3 shadow-2xl flex items-center gap-3"
    >
      <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
        <Download className="w-4 h-4" />
      </div>
      <div className="space-y-0.5 flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate">Install {SITE_NAME}</p>
        <p className="text-[10px] text-zinc-400 truncate">Get the mobile app for quick cinematic access</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <a
          href={APP_DOWNLOAD_URL}
          data-testid="install-banner-download"
          className="accent-active px-2.5 py-1 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-colors cursor-pointer"
        >
          Install
        </a>
        <a
          href={APP_RELEASES_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`All ${SITE_NAME} releases on GitHub`}
          title="All releases on GitHub"
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <Github className="w-3.5 h-3.5" />
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
