import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import AnimeGenrePage from '@/components/anime/genre-page';
import { ANIME_GENRES, isKnownAnimeGenre } from 'constants/anime-taxonomy';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const genre = ANIME_GENRES.find((g) => g.slug === slug);
  if (!genre) return {};
  const t = await getTranslations({ locale, namespace: 'anime' });
  const name = t(`genres.${genre.key}`);
  return {
    title: `${name} — ${t('title')}`,
    description: t('genreDescription', { name }),
  };
}

export default async function AnimeGenre({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isKnownAnimeGenre(slug)) notFound();
  setRequestLocale(locale);
  return <AnimeGenrePage slug={slug} />;
}
