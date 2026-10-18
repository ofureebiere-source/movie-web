import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import AnimePage from '@/components/anime';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'anime' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function Anime({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AnimePage />;
}
