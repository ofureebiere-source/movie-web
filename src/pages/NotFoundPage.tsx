import { Link } from 'react-router-dom';
import { Film, Home, Search } from 'lucide-react';
import { pageTitle } from '@/lib/brand';
import { useEffect } from 'react';

/** The 404 page — ported 1:1 from frameXTV.xyz's `NotFoundPage`. */
export default function NotFoundPage() {
  useEffect(() => {
    document.title = pageTitle('404 — Page Not Found');
  }, []);

  return (
    <div
      data-testid="not-found-page"
      className="min-h-[75vh] w-full flex items-center justify-center px-4 py-12 relative overflow-hidden select-none"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 max-w-lg w-full bg-zinc-950/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] font-mono tracking-widest uppercase text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span>Error 404</span>
        </div>

        <div className="space-y-1">
          <h1 className="text-7xl sm:text-8xl font-black tracking-tighter bg-gradient-to-b from-white via-zinc-200 to-zinc-600 bg-clip-text text-transparent drop-shadow-sm">
            404
          </h1>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Page Not Found</h2>
        </div>

        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">
          The requested URL or content is not available, has been removed, or does not exist on frameXTV.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer active:scale-[0.98]"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <Link
            to="/movies"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-white text-xs sm:text-sm font-medium transition-all active:scale-[0.98]"
          >
            <Film className="w-4 h-4 text-zinc-400" />
            <span>Browse Movies</span>
          </Link>
          <Link
            to="/search"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-white text-xs sm:text-sm font-medium transition-all active:scale-[0.98]"
          >
            <Search className="w-4 h-4 text-zinc-400" />
            <span>Search</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
