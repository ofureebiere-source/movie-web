import { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from 'i18n/routing';
import ApiExplorer from '@/components/api/api-explorer';

/**
 * The service landing page — where the `API` nav entry points.
 *
 * Upstream keeps its API blurb on the same site as the catalogue, so the app
 * mirrors that: a hero, the provider figures, a live explorer for the three
 * endpoints the deployment actually serves, and a link out to the wrapped
 * reference. Nothing here needs a credential; every call is a plain GET.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'api' });

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: {
      canonical: `/${locale}/api`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/api`])),
    },
  };
}

export default async function ApiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'api' });

  const stats = [
    { value: '3', label: t('stats.endpoints') },
    { value: 'GET', label: t('stats.methods') },
    { value: '0', label: t('stats.keys') },
  ];

  return (
    <div className="mx-auto max-w-7xl px-3 py-10 sm:px-6">
      {/* Hero */}
      <section className="max-w-3xl">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-card px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
          {t('badge')}
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {t('title')}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{t('subtitle')}</p>
      </section>

      {/* Provider figures */}
      <section className="mt-8 grid grid-cols-3 gap-3 sm:max-w-lg">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-surface-card p-4 text-center">
            <div className="font-mono text-2xl font-bold text-white">{s.value}</div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Live explorer */}
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold tracking-tight text-white">{t('explorerTitle')}</h2>
        <ApiExplorer />
      </section>

      {/* Reference */}
      <section className="mt-10 rounded-xl border border-line bg-surface-card p-5">
        <h3 className="text-sm font-bold text-white">{t('referenceTitle')}</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">{t('referenceBody')}</p>
        <div className="mt-4 space-y-2">
          {[
            'GET /api/catalog/api/search?query=inception',
            'GET /api/stream?id=27205&type=movie',
            'GET /api/image?url=<poster>&w=500',
          ].map((line) => (
            <pre
              key={line}
              className="overflow-x-auto rounded-lg border border-line bg-black px-3 py-2 font-mono text-[11px] text-zinc-300"
            >
              {line}
            </pre>
          ))}
        </div>
      </section>
    </div>
  );
}
