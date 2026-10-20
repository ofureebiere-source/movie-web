/**
 * People: a person's profile and filmography, assembled from keyless sources.
 *
 * The reference site has no person page and its backend exposes no person
 * endpoint (every `/api/person*` route falls through to the root banner), so
 * there is nothing to port here — this is an addition, and the standing rule
 * that nothing we add may change the dark site's look or behaviour still
 * applies.
 *
 * Three keyless, CORS-permissive services are stitched together, because no
 * single one carries a complete profile:
 *
 *   Wikidata   identity + filmography. A cast member arrives with a TMDB
 *              person id (P4985) which resolves to the entity; from there we
 *              read birth/death dates, birthplace, occupations, the Commons
 *              portrait, the English Wikipedia sitelink, and every credited
 *              work — via the cast (P161) *and* voice (P725) predicates, over
 *              every subclass of film/TV/animations/shorts/specials, carrying a
 *              TMDB id (P4947) — so filmography rows link back into our own
 *              detail pages.
 *   Wikipedia  the biography prose, via the REST summary endpoint.
 *   TVMaze     a fallback portrait when Commons has none, keyed by name.
 *
 * Every call is best-effort: a slow or failing service degrades the page
 * (no biography, no portrait) rather than failing it.
 */

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const WIKIPEDIA_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const TVMAZE = 'https://api.tvmaze.com';

/**
 * Wikidata classes that count as an acting credit, as *roots*: the query walks
 * `wdt:P279*` from these, so every subclass is included too.
 *
 * Listing the exact classes instead was the bug this replaced. A whitelist of
 * four (`film`, `television series`, `television film`, `miniseries`) silently
 * dropped everything else — and the things it dropped were not obscure:
 * `animated film` (Q202866) took out most voice work, `film project`
 * (Q18011172) took out unreleased titles people are most likely to look for
 * (Tom Hanks' *The Comebacker* 2027, *Toy Story 5* 2026), and `short film`
 * (Q24862), `television special` (Q1261214) and `web series` (Q526877) took
 * out the rest. Since these carry TMDB ids just like films do, they are all
 * linkable and all belong on the page.
 */
const WORK_TYPE_ROOTS = [
  'Q11424', // film
  'Q5398426', // television series
  'Q506240', // television film
  'Q1259759', // miniseries
  'Q202866', // animated film
  'Q24862', // short film
  'Q1261214', // television special
  'Q526877', // web series
  'Q18011172', // film project — how unreleased films are typed
];

/**
 * The predicates that credit a person on a work.
 *
 * P161 is the normal cast-member link, but voice roles frequently use P725
 * instead and are not duplicated into P161 — so a query on P161 alone loses the
 * entire Toy Story, Shrek and How to Train Your Dragon filmographies. Both are
 * unioned.
 */
const CREDIT_PREDICATES = ['P161', 'P725'];

export interface PersonProfile {
  /** Wikidata entity id, e.g. `Q35332`. */
  qid: string;
  /** The TMDB person id the profile was opened with. */
  tmdbId: string;
  name: string;
  /** One-line descriptor, e.g. "American actor (born 1963)". */
  description?: string;
  biography?: string;
  birthday?: string;
  deathday?: string;
  placeOfBirth?: string;
  gender?: string;
  occupations: string[];
  image?: string;
  wikipediaUrl?: string;
  filmography: PersonCredit[];
}

export interface PersonCredit {
  /** Wikidata entity id of the work. */
  qid: string;
  title: string;
  /** TMDB id, present when Wikidata records one — makes the row clickable. */
  tmdbId?: string;
  year?: string;
  /** `movie` or `tv`, from the work's Wikidata instance-of. */
  type: 'movie' | 'tv';
  character?: string;
}

// ── fetch helpers ──────────────────────────────────────────────────────

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

interface SparqlResponse {
  results?: { bindings?: Record<string, { value: string }>[] };
}

async function sparql(query: string, signal?: AbortSignal): Promise<Record<string, { value: string }>[]> {
  const url = `${WIKIDATA_SPARQL}?${new URLSearchParams({ query, format: 'json' })}`;
  const body = await getJson<SparqlResponse>(url, signal);
  return body?.results?.bindings ?? [];
}

const escapeLiteral = (value: string) => value.replace(/["\\]/g, '\\$&');

// ── identity ───────────────────────────────────────────────────────────

/**
 * Resolve a TMDB person id to its Wikidata entity id.
 *
 * P4985 is "TMDB person ID". A person Wikidata has not linked returns nothing,
 * which the caller treats as "no profile available".
 */
export async function resolveQid(tmdbId: string, signal?: AbortSignal): Promise<string | null> {
  const id = String(tmdbId).trim();
  if (!/^\d+$/.test(id)) return null;
  const rows = await sparql(
    `SELECT ?person WHERE { ?person wdt:P4985 "${id}" . } LIMIT 1`,
    signal
  );
  const uri = rows[0]?.person?.value;
  return uri ? uri.split('/').pop() ?? null : null;
}

/** Fallback: find a person entity by exact English label. */
async function resolveQidByName(name: string, signal?: AbortSignal): Promise<string | null> {
  const url = `${WIKIDATA_API}?${new URLSearchParams({
    action: 'wbsearchentities',
    search: name,
    language: 'en',
    uselang: 'en',
    type: 'item',
    limit: '1',
    format: 'json',
  })}`;
  const body = await getJson<{ search?: { id?: string }[] }>(url, signal);
  return body?.search?.[0]?.id ?? null;
}

// ── profile + filmography ──────────────────────────────────────────────

interface EntityFacts {
  birthday?: string;
  deathday?: string;
  placeOfBirth?: string;
  gender?: string;
  occupations: string[];
  image?: string;
  wikipediaUrl?: string;
}

async function fetchEntityFacts(qid: string, signal?: AbortSignal): Promise<EntityFacts> {
  const rows = await sparql(
    `SELECT ?dob ?dod ?pobLabel ?genderLabel ?occLabel ?image ?article WHERE {
       OPTIONAL { wd:${qid} wdt:P569 ?dob }
       OPTIONAL { wd:${qid} wdt:P570 ?dod }
       OPTIONAL { wd:${qid} wdt:P19 ?pob }
       OPTIONAL { wd:${qid} wdt:P21 ?gender }
       OPTIONAL { wd:${qid} wdt:P106 ?occ }
       OPTIONAL { wd:${qid} wdt:P18 ?image }
       OPTIONAL { ?article schema:about wd:${qid} ; schema:isPartOf <https://en.wikipedia.org/> }
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
     } LIMIT 40`,
    signal
  );

  const facts: EntityFacts = { occupations: [] };
  const occupations = new Set<string>();
  for (const row of rows) {
    // Date values arrive as `1963-12-18T00:00:00Z`; the page wants the day.
    facts.birthday ??= row.dob?.value?.slice(0, 10);
    facts.deathday ??= row.dod?.value?.slice(0, 10);
    facts.placeOfBirth ??= row.pobLabel?.value;
    facts.gender ??= row.genderLabel?.value;
    facts.image ??= row.image?.value;
    facts.wikipediaUrl ??= row.article?.value;
    const occupation = row.occLabel?.value;
    if (occupation) occupations.add(occupation);
  }
  facts.occupations = Array.from(occupations);
  return facts;
}

/**
 * Every credited work for a person, oldest data first.
 *
 * Two things here are load-bearing and were both bugs before:
 *
 * 1. The credit predicates are unioned (see `CREDIT_PREDICATES`) and the type
 *    filter walks subclasses (see `WORK_TYPE_ROOTS`), so voice work and
 *    unreleased titles survive.
 * 2. `ORDER BY DESC(?year)` before `LIMIT` is what makes the cap safe. With no
 *    ORDER BY the service may cut the result at the cap in any order, so the
 *    newest — and most-wanted — credits could be the ones thrown away for a
 *    prolific actor. Ordering first means the cap can only ever cost the oldest
 *    titles, which is the acceptable end to lose. `year` is optional, so rows
 *    without one sort last rather than displacing dated work.
 */
async function fetchFilmography(qid: string, signal?: AbortSignal): Promise<PersonCredit[]> {
  const roots = WORK_TYPE_ROOTS.map((type) => `wd:${type}`).join(' ');
  const predicates = CREDIT_PREDICATES.map((predicate) => `{ ?work wdt:${predicate} wd:${qid} }`).join(' UNION ');
  const rows = await sparql(
    `SELECT DISTINCT ?work ?workLabel ?year ?tmdb ?characterLabel ?type WHERE {
       ${predicates}
       ?work wdt:P31 ?type .
       ?type wdt:P279* ?root .
       VALUES ?root { ${roots} }
       OPTIONAL { ?work wdt:P577 ?date . BIND(YEAR(?date) AS ?year) }
       OPTIONAL { ?work wdt:P4947 ?tmdb }
       OPTIONAL { ?work wdt:P453 ?character }
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
     } ORDER BY DESC(?year) LIMIT 1000`,
    signal
  );

  const byQid = new Map<string, PersonCredit>();
  for (const row of rows) {
    const workUri = row.work?.value;
    if (!workUri) continue;
    const workQid = workUri.split('/').pop() ?? workUri;
    // A work can bind several rows (one per character); keep the first.
    if (byQid.has(workQid)) continue;
    // Without an English label the service hands back nothing useful to show —
    // the row would read "Q79784". Such credits are dropped rather than listed
    // as an opaque entity id.
    const title = row.workLabel?.value;
    if (!title || /^Q\d+$/.test(title)) continue;
    byQid.set(workQid, {
      qid: workQid,
      title,
      tmdbId: row.tmdb?.value,
      year: row.year?.value,
      type: row.type?.value?.endsWith('Q5398426') || row.type?.value?.endsWith('Q1259759') ? 'tv' : 'movie',
      character: row.characterLabel?.value,
    });
  }
  return Array.from(byQid.values());
}

interface WikipediaSummary {
  title?: string;
  description?: string;
  extract?: string;
  thumbnail?: { source?: string };
}

/**
 * A portrait fallback keyed by name, for people Commons has no image for.
 *
 * TVMaze is keyless and returns a stable portrait URL; the lookup is by exact
 * name, so a miss is expected and simply leaves the placeholder in place.
 */
async function fetchTvmazeImage(name: string, signal?: AbortSignal): Promise<string | undefined> {
  const url = `${TVMAZE}/search/people?${new URLSearchParams({ q: name })}`;
  const body = await getJson<{ person?: { name?: string; image?: { medium?: string } } }[]>(url, signal);
  const exact = body?.find((entry) => entry.person?.name?.toLowerCase() === name.toLowerCase());
  return exact?.person?.image?.medium ?? body?.[0]?.person?.image?.medium;
}

/**
 * The full profile: identity, biography and filmography in one pass.
 *
 * Resolves to `null` only when the person cannot be identified at all; a
 * profile with no biography or no portrait is still returned, because the
 * filmography alone is useful.
 */
export async function getPersonProfile(
  tmdbId: string,
  opts: { name?: string; signal?: AbortSignal } = {}
): Promise<PersonProfile | null> {
  const { signal } = opts;
  const qid = (await resolveQid(tmdbId, signal)) ?? (opts.name ? await resolveQidByName(opts.name, signal) : null);
  if (!qid) return null;

  const [facts, filmography] = await Promise.all([
    fetchEntityFacts(qid, signal),
    fetchFilmography(qid, signal),
  ]);

  // The Wikipedia summary needs the article title, which is the sitelink's
  // last segment (`.../wiki/Brad_Pitt` → `Brad_Pitt`).
  const articleTitle = facts.wikipediaUrl?.split('/wiki/')[1];
  const summary = articleTitle
    ? await getJson<WikipediaSummary>(`${WIKIPEDIA_SUMMARY}/${encodeURIComponent(articleTitle)}`, signal)
    : null;

  const name = opts.name || summary?.title || articleTitle?.replace(/_/g, ' ') || 'Unknown';
  const image =
    summary?.thumbnail?.source ||
    facts.image ||
    (await fetchTvmazeImage(name, signal));

  return {
    qid,
    tmdbId: String(tmdbId),
    name,
    description: summary?.description,
    biography: summary?.extract,
    birthday: facts.birthday,
    deathday: facts.deathday,
    placeOfBirth: facts.placeOfBirth,
    gender: facts.gender,
    occupations: facts.occupations,
    image,
    wikipediaUrl: facts.wikipediaUrl,
    filmography,
  };
}

/**
 * Sort a filmography the way the browse grids sort.
 *
 * The filmography is client-side data, so the shared `sort` ids are applied
 * locally with the same meanings the catalogue gives them: `Newest First` /
 * `Oldest First` order by year, and the popularity/rating ids fall back to
 * newest-first, since Wikidata carries no such score. Rows with no year sink.
 */
export function sortFilmography(credits: PersonCredit[], sort: string | null | undefined): PersonCredit[] {
  const list = [...credits];
  const yearOf = (credit: PersonCredit) => {
    const year = Number(credit.year);
    return Number.isFinite(year) && year > 0 ? year : -Infinity;
  };
  switch (sort) {
    case 'primary_release_date.asc':
    case 'START_DATE_ASC':
      return list.sort((a, b) => yearOf(a) - yearOf(b));
    case 'popularity.desc':
    case 'vote_average.desc':
    case 'primary_release_date.desc':
    case 'START_DATE_DESC':
      return list.sort((a, b) => yearOf(b) - yearOf(a));
    default:
      return list.sort((a, b) => yearOf(b) - yearOf(a));
  }
}
