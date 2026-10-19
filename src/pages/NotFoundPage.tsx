import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { pageTitle } from '@/lib/brand';
import { useEffect } from 'react';

/** The 404 page — ported 1:1 from frameXTV.xyz's `NotFoundPage`. */
export default function NotFoundPage() {
  useEffect(() => {
    document.title = pageTitle('Not Found');
  }, []);

  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500">
          <Compass className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Page not found</h1>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            The page you are looking for has drifted off the map. It may have been moved, renamed, or never existed.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <Link
            to="/"
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all"
          >
            Back to Home
          </Link>
          <Link
            to="/movies"
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
          >
            Browse Movies
          </Link>
        </div>
      </div>
    </div>
  );
}
