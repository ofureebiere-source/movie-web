'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { IoSearchOutline, IoClose } from 'react-icons/io5';
import { ANIME_GENRES } from 'constants/anime-taxonomy';

/** How the loaded anime grid is ordered. */
export type AnimeSort = 'default' | 'newest' | 'oldest' | 'rating' | 'title';

export interface AnimeFilterState {
  query: string;
  genre: string;
  year: string;
  sort: AnimeSort;
}

export const EMPTY_ANIME_FILTERS: AnimeFilterState = {
  query: '',
  genre: '',
  year: '',
  sort: 'default',
};

/**
 * The anime catalogue's controls: search, genre, year and sort.
 *
 * Each control is wired to the only mechanism that can actually honour it, and
 * that differs per control — which is the whole reason this component exists
 * rather than a generic filter bar:
 *
 *  - **Search and year** go to the provider. Year uses its `seasonYear`
 *    parameter; its plain `year` parameter is accepted and ignored, so the
 *    wrong name would leave a control that looks applied and filters nothing.
 *  - **Genre** also goes to the provider, by genre *name* (its anime endpoints
 *    do not take the numeric TMDB ids the film endpoints use).
 *  - **Sort** cannot go to the provider: every sort parameter and value it
 *    accepts is ignored, returning an identically ordered page. So the grid
 *    sorts what it has already loaded, in the browser, and the control says so
 *    in its tooltip rather than implying it reorders the whole catalogue.
 */
export default function AnimeFilterBar({
  filters,
  onChange,
  onClear,
  resultCount,
  searching,
  showGenreChips = true,
}: {
  filters: AnimeFilterState;
  onChange: <K extends keyof AnimeFilterState>(key: K, value: AnimeFilterState[K]) => void;
  onClear: () => void;
  /** Shown next to the controls when a search is active. */
  resultCount?: number | null;
  searching: boolean;
  /**
   * Whether to render the genre chip row. The landing page shows it; a genre
   * sub-page does not, because the route has already fixed the genre and a row
   * of chips there would restate the heading.
   */
  showGenreChips?: boolean;
}) {
  const t = useTranslations('anime');

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years: number[] = [];
    for (let y = current + 1; y >= 1960; y--) years.push(y);
    return years;
  }, []);

  const filtering = Boolean(filters.query || filters.genre || filters.year);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search — provider-backed, so it covers the whole catalogue, not
            just the titles already scrolled into view. */}
        <label className="glass-btn glass-btn-sm flex min-w-[12rem] flex-1 items-center gap-2 sm:flex-none">
          <IoSearchOutline size={15} className="shrink-0 text-content-muted" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onChange('query', e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="w-full min-w-0 bg-transparent text-content-main placeholder:text-content-muted outline-none"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => onChange('query', '')}
              aria-label={t('clear')}
              className="shrink-0 text-content-muted transition-colors hover:text-content-soft"
            >
              <IoClose size={15} />
            </button>
          )}
        </label>

        <Select label={t('yearLabel')} value={filters.year} onChange={(v) => onChange('year', v)}>
          <option value="">{t('allYears')}</option>
          {yearOptions.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </Select>

        <Select
          label={t('sortLabel')}
          value={filters.sort}
          onChange={(v) => onChange('sort', v as AnimeSort)}
          title={t('sortLoadedOnly')}
        >
          <option value="default">{t('sortDefault')}</option>
          <option value="newest">{t('sortNewest')}</option>
          <option value="oldest">{t('sortOldest')}</option>
          <option value="rating">{t('sortRating')}</option>
          <option value="title">{t('sortTitle')}</option>
        </Select>

        {filtering && (
          <button type="button" onClick={onClear} className="glass-btn glass-btn-sm glass-btn-primary">
            {t('clear')}
          </button>
        )}

        {searching && resultCount != null && (
          <span className="text-sm text-content-muted">
            {resultCount} {t('searchResults')}
          </span>
        )}
      </div>

      {/* Genre — single-select, in-page, mirroring the active-chip idiom the
          film browse pages use. */}
      {showGenreChips && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChange('genre', '')}
            aria-pressed={filters.genre === ''}
            className={`glass-btn glass-btn-sm ${filters.genre === '' ? 'glass-btn-active' : ''}`}
          >
            {t('allGenres')}
          </button>
          {ANIME_GENRES.map((genre) => (
            <button
              key={genre.slug}
              type="button"
              // The slug is what travels: `browseAnime` maps it back to the name
              // the provider expects. Storing the name here would look identical
              // on screen and filter nothing.
              onClick={() => onChange('genre', filters.genre === genre.slug ? '' : genre.slug)}
              aria-pressed={filters.genre === genre.slug}
              className={`glass-btn glass-btn-sm ${filters.genre === genre.slug ? 'glass-btn-active' : ''}`}
            >
              {t(`genres.${genre.key}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A labelled native `<select>`, so it stays keyboard- and screen-reader-native. */
function Select({
  label,
  value,
  onChange,
  title,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <label title={title} className="glass-btn glass-btn-sm relative inline-flex cursor-pointer items-center gap-2">
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
