import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

/** Recursive merge: `override` wins, missing branches come from `base`. */
function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown>
): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const prior = out[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      prior &&
      typeof prior === 'object' &&
      !Array.isArray(prior)
    ) {
      out[key] = deepMerge(prior as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/**
 * Server-side i18n configuration for next-intl.
 *
 * Resolves the active locale from the request and loads the corresponding
 * messages file. Falls back to the default locale if the requested one is
 * invalid.
 *
 * Messages are merged over the English file rather than used raw. With
 * fourteen locales, keeping every file complete is not realistic, and a
 * missing key would otherwise render as the raw key path ("movie.info.title")
 * or throw. Falling back to English per key means a partly translated locale
 * degrades to English in the gaps instead of breaking.
 *
 * Wired to the next-intl plugin in `next.config.mjs`.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  const english = (await import('../messages/en.json')).default;

  if (locale === 'en') {
    return { locale, messages: english };
  }

  try {
    const localized = (await import(`../messages/${locale}.json`)).default;
    return { locale, messages: deepMerge(english, localized) };
  } catch {
    // No file for this locale yet — English stands in for all of it.
    return { locale, messages: english };
  }
});
