import PersonPage from '@/components/person/person-page';
import { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

interface PersonPageParams {
  params: { locale: string; id: string };
  searchParams: { name?: string };
}

/**
 * Metadata for a person.
 *
 * Like the title pages, the data is fetched in the browser, so this server
 * function cannot read the person. The name is carried in the query string by
 * the cast card that linked here, which is enough for a useful title; without
 * it the page falls back to the generic label.
 */
export async function generateMetadata({ params, searchParams }: PersonPageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'person' });
  const name = searchParams.name;
  return {
    title: name ? `${name} — ${t('title')}` : t('title'),
    description: t('metaDescription'),
  };
}

export default function Person({ params, searchParams }: PersonPageParams) {
  setRequestLocale(params.locale);
  return <PersonPage id={params.id} name={searchParams.name} />;
}
