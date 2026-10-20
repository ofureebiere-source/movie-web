import { useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Calendar, ExternalLink, MapPin, User } from 'lucide-react';
import MediaCard from '@/components/MediaCard';
import SortSelect, { SORT_MOVIE } from '@/components/SortSelect';
import { GridSkeleton } from '@/components/Skeleton';
import { getPersonProfile, sortFilmography } from '@/lib/people';
import { pageTitle } from '@/lib/brand';

/**
 * A person's profile — the IMDb-style page the cast rail opens.
 *
 * There is no reference to port: frameXTV.xyz has no person page and its
 * backend has no person endpoint. The page therefore reuses the site's own
 * vocabulary so it reads as part of the same product — `page-bg`, the
 * `MediaCard` grid every browse page uses, and the shared sort control — while
 * its data comes from the keyless sources in `src/lib/people.ts`.
 *
 * The cast rail links here with the person's name in `?name=`, which lets a
 * person Wikidata has not linked to a TMDB id still be found by label.
 */

interface PersonPageProps {
  /** Overrides the route param (used by the embed-free detail pages). */
  tmdbId?: string;
}

export default function PersonPage({ tmdbId: tmdbIdProp }: PersonPageProps) {
  const params = useParams<{ tmdbId?: string }>();
  const tmdbId = tmdbIdProp ?? params.tmdbId ?? '';
  const [search] = useSearchParams();
  const nameHint = search.get('name') || undefined;
  const sort = search.get('sort');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['person-profile', tmdbId, nameHint || ''],
    queryFn: ({ signal }) => getPersonProfile(tmdbId, { name: nameHint, signal }),
    enabled: Boolean(tmdbId),
    staleTime: 3_600_000,
    retry: 1,
  });

  useEffect(() => {
    if (data?.name) document.title = pageTitle(`${data.name} — Cast & Crew`);
    else if (nameHint) document.title = pageTitle(`${nameHint} — Cast & Crew`);
  }, [data?.name, nameHint]);

  const credits = useMemo(() => sortFilmography(data?.filmography ?? [], sort), [data?.filmography, sort]);

  // Wikidata records some works without a TMDB id; those have no page here to
  // open, so they are listed as plain rows rather than broken links.
  const linkable = credits.filter((credit) => credit.tmdbId);
  const unlinked = credits.filter((credit) => !credit.tmdbId);

  const born = data?.birthday
    ? new Date(data.birthday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : undefined;
  const died = data?.deathday
    ? new Date(data.deathday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : undefined;

  return (
    <div className="w-full min-h-screen page-bg text-zinc-100 flex flex-col pb-16">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>
      </div>

      {isLoading ? (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="w-40 sm:w-52 aspect-[2/3] rounded-xl bg-zinc-900 animate-pulse shrink-0 mx-auto sm:mx-0" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-64 bg-zinc-900 rounded animate-pulse" />
              <div className="h-4 w-40 bg-zinc-900 rounded animate-pulse" />
              <div className="h-24 w-full bg-zinc-900 rounded animate-pulse" />
            </div>
          </div>
          <GridSkeleton count={12} />
        </div>
      ) : isError ? (
        <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-16 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h1 className="text-lg font-bold text-white">Profile unavailable</h1>
          <p className="text-xs text-zinc-500 font-mono">
            {error instanceof Error ? error.message : 'The people service could not be reached.'}
          </p>
        </div>
      ) : !data ? (
        <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-16 text-center space-y-3">
          <User className="w-10 h-10 text-zinc-600 mx-auto" />
          <h1 className="text-lg font-bold text-white">{nameHint || 'Person'} not found</h1>
          <p className="text-xs text-zinc-500">
            No profile is available for this cast member yet.
          </p>
        </div>
      ) : (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
          {/* Header — portrait, identity and biography. */}
          <div className="flex flex-col md:flex-row gap-6 lg:gap-10 items-start">
            <div className="shrink-0 w-40 sm:w-48 lg:w-56 aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 mx-auto md:mx-0 shadow-lg">
              {data.image ? (
                <img src={data.image} alt={data.name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  <User className="w-10 h-10 opacity-60" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4 text-left min-w-0">
              <div className="space-y-1.5">
                <h1
                  data-testid="person-name"
                  className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white"
                >
                  {data.name}
                </h1>
                {data.description && (
                  <p className="text-sm sm:text-base text-zinc-400">{data.description}</p>
                )}
              </div>

              <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs sm:text-sm">
                {data.occupations.length > 0 && (
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <span className="text-zinc-500">Known for</span>
                    <dd className="font-medium">{data.occupations.slice(0, 3).join(', ')}</dd>
                  </div>
                )}
                {born && (
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    <dd>
                      Born {born}
                      {died ? ` · Died ${died}` : ''}
                    </dd>
                  </div>
                )}
                {data.placeOfBirth && (
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                    <dd>{data.placeOfBirth}</dd>
                  </div>
                )}
              </dl>

              {data.biography && (
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-white tracking-tight">Biography</h2>
                  <p className="text-xs sm:text-sm leading-relaxed text-zinc-400 max-w-3xl">{data.biography}</p>
                </div>
              )}

              {data.wikipediaUrl && (
                <a
                  href={data.wikipediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Read more on Wikipedia
                </a>
              )}
            </div>
          </div>

          {/* Filmography — the shared grid + shared sort control. */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.04] pb-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Filmography</span>
                <span
                  data-testid="filmography-count"
                  className="px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 text-xs font-mono font-semibold"
                >
                  {credits.length} titles
                </span>
              </h2>
              <div className="w-full sm:w-56">
                <SortSelect options={SORT_MOVIE} testId="filmography-sort" />
              </div>
            </div>

            {linkable.length === 0 && unlinked.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-zinc-950/40 border border-white/[0.06]">
                <p className="text-sm font-semibold text-zinc-300">No credits recorded</p>
                <p className="text-xs text-zinc-500 mt-1">This person has no filmography on record yet.</p>
              </div>
            ) : (
              <>
                {linkable.length > 0 && (
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 xs:gap-3 sm:gap-4">
                    {linkable.map((credit) => (
                      <MediaCard
                        key={credit.qid}
                        id={credit.tmdbId as string}
                        type={credit.type}
                        title={credit.title}
                        year={credit.year}
                        className="w-full"
                      />
                    ))}
                  </div>
                )}

                {unlinked.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                      Also credited in
                    </h3>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                      {unlinked.map((credit) => (
                        <li
                          key={credit.qid}
                          className="flex items-baseline justify-between gap-3 px-3 py-2 rounded-lg bg-zinc-950/50 border border-white/[0.05]"
                        >
                          <span className="text-xs text-zinc-300 truncate">
                            {credit.title}
                            {credit.character ? <span className="text-zinc-500"> as {credit.character}</span> : null}
                          </span>
                          {credit.year && <span className="text-[11px] font-mono text-zinc-500 shrink-0">{credit.year}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
