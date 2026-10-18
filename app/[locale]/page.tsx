import HomePage from '@/components/home';
import { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from 'i18n/routing';
import { loadTrendingItems } from 'services/trending';
import type { Locale } from 'i18n/routing';

/**
 * Home page metadata.
 *
 * Both title and description come from `messages/<locale>.json`. The previous
 * catalog exposed a `seoOnPage` block of Vietnamese marketing copy that was
 * used for the `vi` locale; TMDB has no equivalent, and writing our own copy
 * per locale is better anyway — it is the only version that speaks in the
 * site's own voice rather than a provider's.
 *
 * `hreflang` alternates are emitted so Google indexes both locales.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const title = t('homeTitle');
  const description = t('homeDescription');

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      title,
      description,
      type: 'website',
      locale,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

/**
 * The home route.
 *
 * Only the trending row is resolved here; it comes from a static file and so
 * costs nothing. Every other row is fetched in the visitor's browser by
 * `HomePage`, because the catalogue host blocks Vercel's IPs — see
 * `lib/catalog-client` for why.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const trending = await loadTrendingItems(locale as Locale);

  return <HomePage trending={trending} />;
}
