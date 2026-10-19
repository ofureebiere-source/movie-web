'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from 'i18n/routing';
import {
  enrichCredits,
  loadPersonDetail,
  type PersonCredit,
  type PersonDetail,
} from 'services/person-service';
import { slugifyTitle } from 'lib/framextv-adapter';
import { resolveImageUrl } from 'lib/tmdb-image';
import ActorImgDefault from '../../public/default-actor-img.jpg';

/**
 * An actor or crew member's own page.
 *
 * The cast cards on a title used to link to a title search for the person's
 * name, which answers a different question than the one the visitor asked: it
 * returns films *about* them rather than the person. This page is the person.
 *
 * The data comes from Wikimedia (see `services/person-service`) because the
 * catalogue has no person endpoint. It loads in the browser like every other
 * data read in this app, and it degrades in pieces: a person with no Wikidata
 * entity still gets a named page, one with no article still gets their dates
 * and filmography, and one with neither still gets a photograph and a name.
 */
export default function PersonPage({ id, name }: { id: string; name?: string }) {
  const t = useTranslations('person');
  const locale = useLocale();
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [settled, setSettled] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [credits, setCredits] = useState<PersonCredit[]>([]);
  const [hydrating, setHydrating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSettled(false);
    loadPersonDetail(id, name)
      .then((result) => {
        if (cancelled) return;
        setPerson(result);
        setCredits(result?.credits ?? []);
        setSettled(true);
      })
      .catch(() => {
        if (cancelled) return;
        setPerson(null);
        setSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, name, attempt]);

  // Posters, scores and genres arrive one credit at a time, after the page has
  // already drawn. Each landing patches a single row, so the grid fills in
  // place instead of the visitor watching a spinner over an empty list.
  useEffect(() => {
    if (!credits.length) return;
    let cancelled = false;
    setHydrating(true);
    enrichCredits(credits, (index, patch) => {
      if (cancelled) return;
      setCredits((prev) => {
        const next = prev.slice();
        next[index] = { ...next[index], ...patch };
        return next;
      });
    }).finally(() => {
      if (!cancelled) setHydrating(false);
    });
    return () => {
      cancelled = true;
    };
    // `credits` is intentionally absent: this runs once per loaded person, and
    // each `setCredits` above would otherwise re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.id]);

  if (!settled) return <PersonSkeleton />;

  if (!person) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-semibold">{t('unavailable')}</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="glass-btn glass-btn-primary">
          {t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container-wrapper px-4 pb-16 pt-28 md:pt-32">
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          <div className="mx-auto w-48 shrink-0 md:mx-0 md:w-64">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl ring-1 ring-line">
              <Image
                src={person.portraitUrl ?? ActorImgDefault}
                alt={person.name}
                fill
                className="object-cover object-center"
                sizes="(max-width: 768px) 12rem, 16rem"
                priority
              />
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold md:text-4xl">{person.name}</h1>
              {person.description && (
                <p className="text-base text-content-soft">{person.description}</p>
              )}
            </div>

            <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              {person.occupations.length > 0 && (
                <Fact label={t('knownFor')} value={person.occupations.slice(0, 4).join(', ')} />
              )}
              {person.birthday && <Fact label={t('born')} value={person.birthday} />}
              {person.deathday && <Fact label={t('died')} value={person.deathday} />}
            </dl>

            {person.biography && (
              <section className="space-y-2">
                <h2 className="text-lg font-semibold">{t('biography')}</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-content-soft">
                  {person.biography}
                </p>
              </section>
            )}
          </div>
        </div>

        {credits.length > 0 && (
          <Filmography credits={credits} locale={locale} hydrating={hydrating} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// FILMOGRAPHY
// ============================================================================

type SortKey = 'newest' | 'oldest' | 'rating' | 'title';

/**
 * The filmography, presented the way a filmography is normally presented:
 * a poster grid with the controls to narrow and reorder it.
 *
 * A flat text list (what this replaces) cannot answer the three questions a
 * visitor actually arrives with — "what has this person been in recently",
 * "what are they best known for", "what can I watch from a given era" — so
 * sorting, a year filter and a genre filter are all here rather than only the
 * newest-first order the list implied.
 *
 * `credits` is passed whole, including the ones still missing their poster;
 * those render a placeholder card and fill in as hydration lands.
 */
function Filmography({
  credits,
  locale,
  hydrating,
}: {
  credits: PersonCredit[];
  locale: string;
  hydrating: boolean;
}) {
  const t = useTranslations('person');
  const [sort, setSort] = useState<SortKey>('newest');
  const [year, setYear] = useState('');
  const [genre, setGenre] = useState('');
  const [type, setType] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Years and genres are derived from what the person actually has, so neither
  // control can ever offer a value that yields nothing.
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const c of credits) if (c.year) set.add(c.year);
    return Array.from(set).sort((a, b) => b - a);
  }, [credits]);

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const c of credits) for (const g of c.genres ?? []) set.add(g);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [credits]);

  const visible = useMemo(() => {
    const filtered = credits.filter((c) => {
      if (year && String(c.year ?? '') !== year) return false;
      if (genre && !(c.genres ?? []).includes(genre)) return false;
      if (type && c.type !== type) return false;
      return true;
    });
    const bySort: Record<SortKey, (a: PersonCredit, b: PersonCredit) => number> = {
      newest: (a, b) => (b.year ?? 0) - (a.year ?? 0),
      oldest: (a, b) => (a.year ?? 0) - (b.year ?? 0),
      // Unrated titles sort last rather than as zero, so a missing score does
      // not read as "rated lowest".
      rating: (a, b) => (parseFloat(b.rating ?? '') || -1) - (parseFloat(a.rating ?? '') || -1),
      title: (a, b) => a.title.localeCompare(b.title),
    };
    return filtered.sort(bySort[sort]);
  }, [credits, year, genre, type, sort]);

  const filtering = Boolean(year || genre || type);

  return (
    <section className="mt-10 space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">{t('filmography')}</h2>
        <span className="text-sm text-content-muted">
          {visible.length} {t('titles')}
          {hydrating && <span className="ml-2 text-content-muted/70">·</span>}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select label={t('sortLabel')} value={sort} onChange={(v) => setSort(v as SortKey)}>
          <option value="newest">{t('sortNewest')}</option>
          <option value="oldest">{t('sortOldest')}</option>
          <option value="rating">{t('sortRating')}</option>
          <option value="title">{t('sortTitle')}</option>
        </Select>

        <Select label={t('typeLabel')} value={type} onChange={setType}>
          <option value="">{t('allTypes')}</option>
          <option value="movie">{t('typeMovie')}</option>
          <option value="tv">{t('typeTv')}</option>
        </Select>

        <Select label={t('yearLabel')} value={year} onChange={setYear}>
          <option value="">{t('allYears')}</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </Select>

        <Select label={t('genreLabel')} value={genre} onChange={setGenre}>
          <option value="">{t('allGenres')}</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>

        {filtering && (
          <button
            type="button"
            onClick={() => {
              setYear('');
              setGenre('');
              setType('');
            }}
            className="glass-btn glass-btn-sm glass-btn-primary"
          >
            {t('clear')}
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <ViewToggle active={view === 'grid'} onClick={() => setView('grid')} label={t('viewGrid')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </ViewToggle>
          <ViewToggle active={view === 'list'} onClick={() => setView('list')} label={t('viewList')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <circle cx="4" cy="6" r="1" />
              <circle cx="4" cy="12" r="1" />
              <circle cx="4" cy="18" r="1" />
            </svg>
          </ViewToggle>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-content-muted">{t('noMatches')}</p>
      ) : view === 'grid' ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visible.map((credit) => (
            <li key={`${credit.type}-${credit.tmdbId}`}>
              <CreditCard credit={credit} locale={locale} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((credit) => (
            <li key={`${credit.type}-${credit.tmdbId}`}>
              <CreditListRow credit={credit} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A labelled native `<select>`. Native so it is keyboard- and screen-reader-native. */
function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="glass-btn glass-btn-sm relative inline-flex cursor-pointer items-center gap-2">
      <span className="text-content-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-4 text-content-main outline-none [&>option]:bg-surface-secondary [&>option]:text-content-main"
      >
        {children}
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="pointer-events-none absolute right-2 text-content-muted"
        aria-hidden
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </label>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`glass-btn glass-btn-sm px-2 ${active ? 'glass-btn-primary' : ''}`}
    >
      {children}
    </button>
  );
}

/** Poster card, the grid's unit. */
function CreditCard({ credit, locale }: { credit: PersonCredit; locale: string }) {
  const poster = resolveImageUrl(credit.posterUrl, 'poster');
  const href = `/movies/${creditSlug(credit)}`;
  const score = parseFloat(credit.rating ?? '');

  return (
    <Link href={href} locale={locale} title={credit.title} className="group block">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface-secondary/60 ring-1 ring-line">
        {poster ? (
          <Image
            src={poster}
            alt={credit.title}
            fill
            className="object-cover object-center transition-transform duration-200 group-hover:scale-105"
            sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 22vw, 16vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-content-muted">
            {credit.title}
          </div>
        )}
        {Number.isFinite(score) && (
          <span className="absolute right-1.5 top-1.5 rounded bg-surface-primary/70 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">
            {score.toFixed(1)}
          </span>
        )}
      </div>
      <div className="mt-2 space-y-0.5">
        <p className="line-clamp-2 text-sm font-medium text-content-main group-hover:text-brand">
          {credit.title}
        </p>
        {credit.year && <p className="text-xs text-content-muted">{credit.year}</p>}
        {credit.character && (
          <p className="line-clamp-1 text-xs text-content-muted">{credit.character}</p>
        )}
      </div>
    </Link>
  );
}

/** List row, the alternative view. */
function CreditListRow({ credit, locale }: { credit: PersonCredit; locale: string }) {
  const poster = resolveImageUrl(credit.posterUrl, 'poster');
  const score = parseFloat(credit.rating ?? '');

  return (
    <Link
      href={`/movies/${creditSlug(credit)}`}
      locale={locale}
      className="flex items-center gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-surface-chip focus-visible:bg-surface-chip"
    >
      <div className="relative h-[72px] w-12 shrink-0 overflow-hidden rounded bg-surface-secondary/60">
        {poster && (
          <Image src={poster} alt={credit.title} fill className="object-cover" sizes="3rem" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content-main">{credit.title}</p>
        <p className="text-xs text-content-muted">
          {[credit.year, credit.character].filter(Boolean).join(' · ')}
        </p>
      </div>
      {Number.isFinite(score) && (
        <span className="shrink-0 text-xs font-semibold text-yellow-400">{score.toFixed(1)}</span>
      )}
    </Link>
  );
}

/**
 * The catalogue slug for a credit.
 *
 * Every credit carries a TMDB id — the filmography query requires one — so this
 * always mints the `title-type-id` shape the catalogue resolves.
 */
function creditSlug(credit: PersonCredit): string {
  return `${slugifyTitle(credit.title) || 'title'}-${credit.type}-${credit.tmdbId}`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-content-muted">{label}</dt>
      <dd className="text-content-soft">{value}</dd>
    </div>
  );
}

function PersonSkeleton() {
  return (
    <div className="container-wrapper px-4 pb-16 pt-28 md:pt-32">
      <div className="flex flex-col gap-8 md:flex-row md:items-start">
        <div className="mx-auto aspect-[2/3] w-48 shrink-0 animate-pulse rounded-2xl bg-surface-secondary/60 md:mx-0 md:w-64" />
        <div className="flex-1 space-y-4">
          <div className="h-9 w-1/2 animate-pulse rounded bg-surface-secondary/60" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-surface-secondary/60" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-surface-secondary/60" />
        </div>
      </div>
    </div>
  );
}
