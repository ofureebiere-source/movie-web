import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { isMaintenanceMode } from './lib/maintenance';

const intlMiddleware = createIntlMiddleware(routing);

const PROTECTED_PATHS = ['/movies/collection', '/movies/recent'];
const LOCALE_PREFIX_REGEX = new RegExp(`^/(${routing.locales.join('|')})(?=/|$)`);
const LOCALE_COOKIE = 'NEXT_LOCALE';
const LOCALE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;
const MAINTENANCE_PREFIX = '/maintenance';

/**
 * Vercel-only geo signal. Returns null on local dev / non-Vercel hosts so the
 * caller falls through to next-intl's Accept-Language detection.
 *
 * Country → locale, using the ISO 3166-1 alpha-2 code Vercel supplies. The
 * list covers the locales in `i18n/routing`; anything unlisted falls to
 * English, which is the safe default for a catalogue whose titles and artwork
 * are language-neutral.
 *
 * A country with more than one official language picks the majority one
 * (Belgium → fr, Switzerland → de, Canada → en). Getting those wrong costs a
 * visitor a click at most, and there is no click to make any more — so the
 * majority guess is the whole policy.
 */
const LOCALE_BY_COUNTRY: Record<string, string> = {
  // Vietnamese
  VN: 'vi',

  // Chinese
  CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh',

  // Korean
  KR: 'ko', KP: 'ko',

  // Japanese
  JP: 'ja',

  // Thai
  TH: 'th',

  // Indonesian
  ID: 'id',

  // Spanish — Spain plus Latin America
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es',
  EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es',
  SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', PR: 'es',

  // French — France, francophone Europe and Africa
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', SN: 'fr', CI: 'fr', CM: 'fr',
  ML: 'fr', BF: 'fr', NE: 'fr', TG: 'fr', BJ: 'fr', GA: 'fr', CG: 'fr',
  CD: 'fr', MG: 'fr', HT: 'fr',

  // Portuguese
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', GW: 'pt', ST: 'pt', TL: 'pt',

  // German
  DE: 'de', AT: 'de', LI: 'de',

  // Russian
  RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru', TJ: 'ru', TM: 'ru', UZ: 'ru',

  // Hindi
  IN: 'hi',

  // Arabic
  SA: 'ar', AE: 'ar', EG: 'ar', DZ: 'ar', MA: 'ar', TN: 'ar', LY: 'ar',
  JO: 'ar', LB: 'ar', SY: 'ar', IQ: 'ar', KW: 'ar', QA: 'ar', BH: 'ar',
  OM: 'ar', YE: 'ar', SD: 'ar', PS: 'ar', MR: 'ar', SO: 'ar', DJ: 'ar',
  KM: 'ar',
};

function pickLocaleFromGeo(request: NextRequest): string | null {
  const country = request.geo?.country;
  if (!country) return null;
  return LOCALE_BY_COUNTRY[country] ?? 'en';
}

/**
 * Locale for the maintenance page: explicit URL prefix wins, then the user's
 * stored choice, then geo, then the default. Never touches next-intl — the
 * maintenance route lives outside the `[locale]` segment.
 */
function resolveMaintenanceLocale(request: NextRequest): string {
  const prefix = request.nextUrl.pathname.match(LOCALE_PREFIX_REGEX)?.[1];
  if (prefix) return prefix;

  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie && routing.locales.includes(cookie as any)) return cookie;

  return pickLocaleFromGeo(request) ?? routing.defaultLocale;
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathWithoutLocale = pathname.replace(LOCALE_PREFIX_REGEX, '') || '/';
  const isMaintenancePath = pathname.startsWith(MAINTENANCE_PREFIX);

  // ---- Maintenance gate ----
  // Runs before everything else so a gated request never reaches a layout,
  // a provider, or a movie API call. The maintenance route renders on its own
  // (own <html>, no Providers), so it's simply let through.
  if (isMaintenanceMode()) {
    if (isMaintenancePath) return NextResponse.next();

    const url = new URL(`${MAINTENANCE_PREFIX}/${resolveMaintenanceLocale(request)}`, request.url);
    const response = NextResponse.rewrite(url);
    // The URL still looks like a normal page, so keep crawlers off the
    // stand-in content while the real page is unavailable.
    response.headers.set('x-robots-tag', 'noindex');
    return response;
  }

  // Maintenance is off — the page has nothing to say, send visitors home.
  if (isMaintenancePath) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Auth gate
  const isProtected = PROTECTED_PATHS.some((p) => pathWithoutLocale.startsWith(p));
  if (isProtected && !request.cookies.has('accessToken')) {
    const match = pathname.match(LOCALE_PREFIX_REGEX);
    const locale = match?.[1] ?? routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  // Geo auto-detect — only for first-time bare-URL visitors. Manual choice
  // (stored in NEXT_LOCALE) wins forever after.
  const hasLocalePrefix = LOCALE_PREFIX_REGEX.test(pathname);
  const hasLocaleCookie = request.cookies.has(LOCALE_COOKIE);
  if (!hasLocalePrefix && !hasLocaleCookie) {
    const geoLocale = pickLocaleFromGeo(request);
    if (geoLocale) {
      const targetPath = pathname === '/' ? `/${geoLocale}` : `/${geoLocale}${pathname}`;
      const url = new URL(targetPath, request.url);
      url.search = request.nextUrl.search;

      const response = NextResponse.redirect(url);
      response.cookies.set(LOCALE_COOKIE, geoLocale, {
        path: '/',
        maxAge: LOCALE_COOKIE_MAX_AGE_SEC,
        sameSite: 'lax',
      });
      return response;
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
