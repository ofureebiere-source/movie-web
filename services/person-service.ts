/**
 * Person (actor/crew) detail, assembled keylessly from Wikimedia.
 *
 * The catalogue has no person endpoint. `/api/person/{id}` and every variant
 * of it falls through to the backend's health payload, and the provider's
 * `peoples` list comes back empty for the titles that carry one — so there is
 * nothing on the framextv side to read. Rather than leave a cast click
 * pointing at a title search (which is what it used to do, and which answers
 * a different question than the visitor asked), this module reads the person
 * from sources that need no key at all.
 *
 * Two hops, both keyless and both CORS-open (`access-control-allow-origin: *`,
 * verified):
 *
 *   1. **Wikidata** maps the TMDB person id the cast card carries (property
 *      P4985, "TMDB person ID") to a Wikidata entity, then reads the label,
 *      description, birth/death dates, portrait, occupations and the English
 *      Wikipedia article title off it — one SPARQL query.
 *   2. **Wikipedia REST** turns that article title into prose. Its summary
 *      endpoint returns an extract and a thumbnail; the extract is the
 *      biography, and it is the only part of this page that is long-form.
 *
 * Filmography is a second SPARQL query: works the person is a cast member of
 * (P161), with the TMDB work id (P4947) so each entry can be linked back into
 * this app's own catalogue. That is the difference between a filmography that
 * is a list of names and one the visitor can click through and play.
 *
 * Everything here is best-effort and independently optional: a person with no
 * Wikidata entity, no article, or no filmography still renders the parts that
 * did resolve. Nothing in this file is required for a page to draw.
 */

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const WIKIPEDIA_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary';

/**
 * Wikidata asks that clients identify themselves, and throttles anonymous
 * bulk traffic. A plain descriptive UA is the documented expectation; there
 * is no key involved.
 */
const USER_AGENT = 'netflix-pro/1.0 (person pages; keyless)';

const TIMEOUT_MS = 12000;

/** Person metadata changes rarely; a day in the session cache is plenty. */
const REVALIDATE_SEC = 60 * 60 * 24;

/**
 * Bump when `PersonDetail` changes shape. The cache lives for a day in
 * sessionStorage, so without a version a deploy that alters the shape leaves
 * returning visitors reading their own stale copy — which is exactly what
 * happened when the filmography filter changed.
 */
const CACHE_VERSION = 'v2';
const CACHE_PREFIX = `person:${CACHE_VERSION}:`;
const inflight = new Map<string, Promise<unknown>>();

export interface PersonCredit {
  /** TMDB work id — every credit carries one, so every credit is playable. */
  tmdbId: string;
  title: string;
  year?: number;
  character?: string;
  /** `movie` | `tv` — read from which TMDB id property the work carries. */
  type: 'movie' | 'tv';
}

export interface PersonDetail {
  id: string;
  name: string;
  description?: string;
  biography?: string;
  birthday?: string;
  deathday?: string;
  portraitUrl?: string;
  occupations: string[];
  imdbId?: string;
  /** English Wikipedia article title, when one exists. */
  wikipediaTitle?: string;
  credits: PersonCredit[];
}

// ============================================================================
// CACHE — same shape as the catalogue layer, so behaviour is predictable
// ============================================================================

function readCache<T>(key: string, ttlSec: number): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; body: T };
    if (Date.now() - parsed.at > ttlSec * 1000) {
      window.sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return parsed.body;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, body: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), body }));
  } catch {
    /* quota or private mode — the cache is an optimisation, never a requirement */
  }
}

// ============================================================================
// SPARQL
// ============================================================================

interface SparqlBinding {
  type: string;
  value: string;
  'xml:lang'?: string;
}

interface SparqlResponse {
  results?: { bindings?: Record<string, SparqlBinding>[] };
}

async function sparql(query: string): Promise<Record<string, SparqlBinding>[]> {
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/sparql-results+json' },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const body = (await res.json()) as SparqlResponse;
    return body.results?.bindings ?? [];
  } catch {
    // A person page with no Wikidata answer still shows name + filmography-free
    // shell; failing the whole page over metadata would be worse.
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Strip the entity prefix: `http://www.wikidata.org/entity/Q35332` -> `Q35332`. */
function qidOf(uri: string): string {
  return uri.slice(uri.lastIndexOf('/') + 1);
}

/** Escape a string for a SPARQL string literal. */
function literal(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ============================================================================
// PERSON
// ============================================================================

/** `1963-12-18T00:00:00Z` -> `1963-12-18`. */
function dateOnly(value: string | undefined): string | undefined {
  return value ? value.slice(0, 10) : undefined;
}

async function fetchPersonCore(tmdbId: string): Promise<{
  qid: string;
  name?: string;
  description?: string;
  birthday?: string;
  deathday?: string;
  portraitUrl?: string;
  imdbId?: string;
  occupations: string[];
  wikipediaTitle?: string;
} | null> {
  // P4985 is the TMDB person id. A missing binding means this person is not in
  // Wikidata, which is a legitimate outcome, not an error.
  const query = `
SELECT ?person ?personLabel ?desc ?birth ?death ?img ?imdb ?occupationLabel ?articleTitle WHERE {
  ?person wdt:P4985 "${literal(tmdbId)}" .
  OPTIONAL { ?person schema:description ?desc . FILTER(lang(?desc) = "en") }
  OPTIONAL { ?person wdt:P569 ?birth }
  OPTIONAL { ?person wdt:P570 ?death }
  OPTIONAL { ?person wdt:P18 ?img }
  OPTIONAL { ?person wdt:P345 ?imdb }
  OPTIONAL { ?person wdt:P106 ?occupation }
  OPTIONAL {
    ?article schema:about ?person ;
             schema:isPartOf <https://en.wikipedia.org/> ;
             schema:name ?articleTitle .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 20`;

  const rows = await sparql(query);
  if (!rows.length) return null;

  const first = rows[0];
  const occupations: string[] = [];
  for (const row of rows) {
    const label = row.occupationLabel?.value;
    if (label && !occupations.includes(label)) occupations.push(label);
  }

  const portrait = first.img?.value;
  return {
    qid: qidOf(first.person.value),
    name: first.personLabel?.value,
    description: first.desc?.value,
    birthday: dateOnly(first.birth?.value),
    deathday: dateOnly(first.death?.value),
    // Special:FilePath redirects to the actual file and takes a width, so the
    // image proxy gets a modest original instead of a full-size portrait.
    portraitUrl: portrait ? `${portrait}?width=400` : undefined,
    imdbId: first.imdb?.value,
    occupations,
    wikipediaTitle: first.articleTitle?.value,
  };
}

async function fetchBiography(wikipediaTitle: string | undefined): Promise<string | undefined> {
  if (!wikipediaTitle) return undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${WIKIPEDIA_SUMMARY}/${encodeURIComponent(wikipediaTitle.replace(/ /g, '_'))}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { extract?: string };
    return body.extract?.trim() || undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Works the person acted in, newest first, each carrying the TMDB id so the
 * entry links into this app's own catalogue and is playable.
 *
 * P161 is "cast member"; P4947 is "TMDB movie ID" and P4983 "TMDB TV series
 * ID". Both id properties are *required*, not optional, and that is a
 * deliberate filter rather than an oversight: without it Wikidata returns
 * talk-show appearances, commercials, award-ceremony segments and crew
 * credits ("Ruth's Chris Employees", "Halloween Candy ft. Edward Norton"),
 * which are noise in a filmography and which could not be played even if they
 * were listed. Requiring an id keeps only titles this catalogue can actually
 * resolve — 41 clean entries for a prolific actor, against ~55 with junk.
 *
 * The two id properties are read with UNION rather than two OPTIONALs so a
 * work matches once and the row count stays small.
 */
async function fetchFilmography(qid: string): Promise<PersonCredit[]> {
  const query = `
SELECT ?work ?workLabel ?date ?tmdbMovie ?tmdbTv ?characterLabel WHERE {
  ?work wdt:P161 wd:${qid} .
  { ?work wdt:P4947 ?tmdbMovie } UNION { ?work wdt:P4983 ?tmdbTv }
  OPTIONAL { ?work wdt:P577 ?date }
  OPTIONAL {
    ?work p:P161 ?st .
    ?st ps:P161 wd:${qid} ; pq:P453 ?character .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 300`;

  const rows = await sparql(query);
  const byWork = new Map<string, PersonCredit>();

  for (const row of rows) {
    const title = row.workLabel?.value;
    if (!title) continue;

    const tmdbId = row.tmdbMovie?.value ?? row.tmdbTv?.value;
    if (!tmdbId) continue;
    const type: 'movie' | 'tv' = row.tmdbTv?.value ? 'tv' : 'movie';
    const yearRaw = row.date?.value;
    const year = yearRaw ? parseInt(yearRaw.slice(0, 4), 10) : undefined;
    const character = row.characterLabel?.value;

    // A work can repeat once per cast statement; keep the richest row.
    const existing = byWork.get(tmdbId);
    if (existing) {
      if (!existing.character && character) existing.character = character;
      if (existing.year === undefined && Number.isFinite(year)) existing.year = year;
      continue;
    }

    byWork.set(tmdbId, {
      tmdbId,
      title,
      year: Number.isFinite(year) ? year : undefined,
      character,
      type,
    });
  }

  return Array.from(byWork.values()).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

/**
 * Everything the person page renders, in one call.
 *
 * Resolves to `null` only when the person is absent from Wikidata *and* we
 * have no name to fall back on — i.e. when there is genuinely nothing to show.
 * The caller passes the name from the cast card so that even an unknown person
 * gets a page with their name and photograph.
 */
export async function loadPersonDetail(
  tmdbId: string,
  fallbackName?: string
): Promise<PersonDetail | null> {
  if (!tmdbId) return null;

  const cacheKey = `${tmdbId}`;
  const cached = readCache<PersonDetail>(cacheKey, REVALIDATE_SEC);
  if (cached) return cached;

  const pending = inflight.get(cacheKey);
  if (pending) return pending as Promise<PersonDetail | null>;

  const request = (async (): Promise<PersonDetail | null> => {
    const core = await fetchPersonCore(tmdbId);
    const name = core?.name ?? fallbackName;
    if (!name) return null;

    // Biography and filmography both depend on the core result but not on each
    // other, so they run together rather than in sequence.
    const [biography, credits] = await Promise.all([
      fetchBiography(core?.wikipediaTitle),
      core ? fetchFilmography(core.qid) : Promise.resolve([] as PersonCredit[]),
    ]);

    const detail: PersonDetail = {
      id: tmdbId,
      name,
      description: core?.description,
      biography,
      birthday: core?.birthday,
      deathday: core?.deathday,
      portraitUrl: core?.portraitUrl,
      occupations: core?.occupations ?? [],
      imdbId: core?.imdbId,
      wikipediaTitle: core?.wikipediaTitle,
      credits,
    };
    writeCache(cacheKey, detail);
    return detail;
  })();

  inflight.set(cacheKey, request);
  request.finally(() => inflight.delete(cacheKey)).catch(() => {
    /* the consumer handles the rejection */
  });
  return request;
}
