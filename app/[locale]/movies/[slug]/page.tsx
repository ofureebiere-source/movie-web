import DetailPageClient from '@/components/movie/detail-page-client';
import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

interface MoviePageParams {
  params: { locale: string; slug: string };
}

/**
 * Metadata for a title.
 *
 * The catalogue is fetched in the visitor's browser, so this server function
 * cannot read the title — asking would return a Cloudflare challenge rather
 * than JSON (see `lib/catalog-client`). The title is therefore derived from
 * the slug, which embeds the name, and the description is left to the
 * component. This keeps the route indexable without a server-side fetch.
 */
export async function generateMetadata({ params }: MoviePageParams): Promise<Metadata> {
  return { title: humanizeSlug(params.slug) };
}

/** `the-batman-movie-414906` -> `The Batman`. */
function humanizeSlug(slug: string): string {
  const withoutId = slug.replace(/-(?:movie|tv|anime)-\d+$/, '');
  const words = withoutId
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(' ') || 'Movie';
}

export default function Movie({ params }: MoviePageParams) {
  setRequestLocale(params.locale);
  return <DetailPageClient slug={params.slug} />;
}
