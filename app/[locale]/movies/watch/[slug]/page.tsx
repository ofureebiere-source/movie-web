import WatchPageClient from '@/components/watch/watch-page-client';
import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

interface WatchPageParams {
  params: { locale: string; slug: string };
}

/**
 * Metadata for the watch route.
 *
 * Derived from the slug rather than fetched: the catalogue is read in the
 * visitor's browser (see `lib/catalog-client`), so a server-side lookup here
 * would only return a Cloudflare challenge.
 */
export async function generateMetadata({ params }: WatchPageParams): Promise<Metadata> {
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

export default function MovieWatch({ params }: WatchPageParams) {
  setRequestLocale(params.locale);
  return <WatchPageClient slug={params.slug} />;
}
