'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from 'i18n/routing';
import { loadPersonDetail, type PersonDetail } from 'services/person-service';
import { slugifyTitle } from 'lib/framextv-adapter';
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

  useEffect(() => {
    let cancelled = false;
    setSettled(false);
    loadPersonDetail(id, name)
      .then((result) => {
        if (cancelled) return;
        setPerson(result);
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
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl ring-1 ring-white/15">
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
                <p className="text-base text-gray-300">{person.description}</p>
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
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-300">
                  {person.biography}
                </p>
              </section>
            )}

            {person.credits.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">{t('filmography')}</h2>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {person.credits.slice(0, 60).map((credit) => (
                    <li key={`${credit.title}-${credit.year ?? ''}`}>
                      <CreditRow credit={credit} locale={locale} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-gray-200">{value}</dd>
    </div>
  );
}

/**
 * One filmography entry, linked into this app's own catalogue.
 *
 * Every entry carries a TMDB id (the query requires one), so the slug always
 * resolves — see `slugFor`, which mints the same `title-type-id` shape.
 */
function CreditRow({
  credit,
  locale,
}: {
  credit: { tmdbId: string; title: string; year?: number; character?: string; type: 'movie' | 'tv' };
  locale: string;
}) {
  const label = (
    <>
      <span className="font-medium text-gray-100">{credit.title}</span>
      {credit.year ? <span className="text-gray-500"> ({credit.year})</span> : null}
      {credit.character ? (
        <span className="block text-xs text-gray-400">{credit.character}</span>
      ) : null}
    </>
  );

  const slug = `${slugifyTitle(credit.title) || 'title'}-${credit.type}-${credit.tmdbId}`;
  return (
    <Link
      href={`/movies/${slug}`}
      locale={locale}
      className="block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5 focus-visible:bg-white/5"
    >
      {label}
    </Link>
  );
}

function PersonSkeleton() {
  return (
    <div className="container-wrapper px-4 pb-16 pt-28 md:pt-32">
      <div className="flex flex-col gap-8 md:flex-row md:items-start">
        <div className="mx-auto aspect-[2/3] w-48 shrink-0 animate-pulse rounded-2xl bg-neutral-800/60 md:mx-0 md:w-64" />
        <div className="flex-1 space-y-4">
          <div className="h-9 w-1/2 animate-pulse rounded bg-neutral-800/60" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-800/60" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-800/60" />
        </div>
      </div>
    </div>
  );
}
