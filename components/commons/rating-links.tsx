import { FaImdb } from 'react-icons/fa';
import TMDBLogo from '../logos/TMDB-Logo';
import type Imdb from 'types/imdb';
import type Tmdb from 'types/tmdb';

interface RatingLinksProps {
  imdb?: Imdb;
  tmdb?: Tmdb;
  /** Compact = mobile-friendly inline; Default = desktop block layout */
  variant?: 'default' | 'compact';
}

const isValidScore = (score?: number) => typeof score === 'number' && score > 0;

const formatVotes = (count?: number) => {
  if (!count || count <= 0) return '';
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
};

/**
 * Rating blocks for IMDb and TMDB.
 *
 * These used to be outbound links: clicking a score opened IMDb or TMDB in a
 * new tab. That is gone — nothing on a details page should navigate away from
 * the app, and a rating is information, not a destination. The scores, vote
 * counts and logos are unchanged; they are simply no longer anchors.
 */
export default function RatingLinks({ imdb, tmdb, variant = 'default' }: RatingLinksProps) {
  const showTmdb = isValidScore(tmdb?.vote_average);
  const showImdb = isValidScore(imdb?.vote_average);

  if (!showTmdb && !showImdb) return null;

  if (variant === 'compact') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {showTmdb && (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-600/30 text-sm"
            title="Điểm TMDB"
          >
            <span className="font-bold">{tmdb!.vote_average.toFixed(1)}</span>
            <span className="text-white/60 text-xs">TMDB</span>
          </span>
        )}
        {showImdb && (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-yellow-400/30 text-sm"
            title="Điểm IMDb"
          >
            <FaImdb className="text-yellow-400" />
            <span className="font-bold">{imdb!.vote_average.toFixed(1)}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showTmdb && (
        <span
          className="inline-flex items-center gap-3 px-3 py-2 rounded-md bg-emerald-600/30"
          title="Điểm TMDB"
        >
          <div className="w-[5rem] flex-shrink-0">
            <TMDBLogo />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-lg">{tmdb!.vote_average.toFixed(1)}</span>
            <span className="text-white/60 text-sm">/10</span>
          </div>
          {tmdb!.vote_count > 0 && (
            <span className="text-xs text-white/60">({formatVotes(tmdb!.vote_count)})</span>
          )}
        </span>
      )}

      {showImdb && (
        <span
          className="inline-flex items-center gap-3 px-3 py-2 rounded-md bg-yellow-400/30"
          title="Điểm IMDb"
        >
          <FaImdb className="text-yellow-400 text-3xl flex-shrink-0" />
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-lg">{imdb!.vote_average.toFixed(1)}</span>
            <span className="text-white/60 text-sm">/10</span>
          </div>
          {imdb!.vote_count > 0 && (
            <span className="text-xs text-white/60">({formatVotes(imdb!.vote_count)})</span>
          )}
        </span>
      )}
    </div>
  );
}
