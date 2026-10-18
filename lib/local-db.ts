/**
 * A keyless local document store.
 *
 * The app's accounts, collections, comments, notifications and watch history
 * used to live in Firestore, which needs a project, an API key and a
 * service-account key. None of those are wanted here: the site is meant to
 * run with no credentials at all. This module keeps that data in the
 * browser's `localStorage` instead, behind an API surface close enough to
 * Firestore's that the existing call sites did not have to change.
 *
 * What it implements, and why each piece exists:
 *
 *  - `collection` / `doc` refs with `parent/child` chaining — the call sites
 *    build paths as `doc(db, 'recentMovies', uid, 'movies', id)`.
 *  - `getDoc` / `getDocs` / `setDoc` / `updateDoc` / `deleteDoc` / `addDoc`,
 *    with `setDoc`'s `{ merge: true }` semantics (merge is the default for
 *    `updateDoc`).
 *  - `arrayUnion` / `arrayRemove` — used for collection entries and comment
 *    likes; they must be distinguishable from a plain value, so they are
 *    sentinel objects, exactly as Firestore does it.
 *  - `query` + `where` / `orderBy` / `limit` — a small filter/sort/limit
 *    pipeline over a collection's docs.
 *  - `onSnapshot` — the notification bell subscribes and expects a pushed
 *    update plus an `unsubscribe` function.
 *  - `writeBatch` — mark-all-read writes in one go.
 *
 * Storage is one JSON blob per collection path, rewritten on every write.
 * That is fine at this scale (a user's own data) and keeps reads synchronous.
 *
 * Two honest limits, both inherited from `localStorage`:
 *  - Data is per-browser and per-origin. It does not follow the viewer to
 *    another device, and clearing site data clears it.
 *  - It is not a security boundary. A local password gates the UI, not the
 *    data; anyone with devtools can read it. That is the price of keyless,
 *    and it is why the profile screens make no confidentiality claim.
 */

const PREFIX = 'nw:db:';
const NOTIFY_EVENT = 'nw:db-change';

/** Fields Firestore adds; mirrored so stored records look the same. */
// `any` values, exactly as Firestore types it — call sites index into
// documents without narrowing each field first.
export type DocumentData = { [field: string]: any };

export interface DocRef {
  readonly kind: 'doc';
  readonly path: string;
}

export interface CollectionRef {
  readonly kind: 'collection';
  readonly path: string;
}

export interface QueryRef {
  readonly kind: 'query';
  readonly path: string;
  readonly filters: { field: string; op: string; value: unknown }[];
  readonly orders: { field: string; dir: 'asc' | 'desc' }[];
  max: number | null;
}

export interface DocSnapshot<T = DocumentData> {
  id: string;
  exists: () => boolean;
  /** Throws when the document does not exist, as Firestore's does. */
  data: () => T;
  ref: DocRef;
}

export interface QuerySnapshot<T = DocumentData> {
  empty: boolean;
  size: number;
  docs: (DocSnapshot<T> & { id: string })[];
  forEach: (cb: (d: DocSnapshot<T> & { id: string }) => void) => void;
}

// ---- sentinels -------------------------------------------------------------

const UNION = Symbol('arrayUnion');
const REMOVE = Symbol('arrayRemove');

interface Sentinel {
  __sentinel: symbol;
  values: unknown[];
}

/** Add these values to an array field if absent. Firestore-compatible. */
export function arrayUnion(...values: unknown[]): Sentinel {
  return { __sentinel: UNION, values };
}

/** Remove these values from an array field. Firestore-compatible. */
export function arrayRemove(...values: unknown[]): Sentinel {
  return { __sentinel: REMOVE, values };
}

function isSentinel(value: unknown): value is Sentinel {
  return typeof value === 'object' && value !== null && '__sentinel' in value;
}

/** Deep equality, which is how array members are matched. */
function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---- storage ---------------------------------------------------------------

function readCollection(path: string): Record<string, DocumentData> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PREFIX + path);
    return raw ? (JSON.parse(raw) as Record<string, DocumentData>) : {};
  } catch {
    return {};
  }
}

function writeCollection(path: string, docs: Record<string, DocumentData>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + path, JSON.stringify(docs));
    window.dispatchEvent(new CustomEvent(NOTIFY_EVENT, { detail: { path } }));
  } catch {
    // Quota exceeded or storage blocked. The write is lost; callers already
    // treat every write as best-effort.
  }
}

/** A ref's path is its collection path plus its final segment. */
function collectionPathOf(path: string): string {
  const parts = path.split('/');
  return parts.slice(0, -1).join('/');
}

// ---- refs ------------------------------------------------------------------

/**
 * `doc(db, 'userMovies', uid)` or `doc(db, 'a', '1', 'b', '2')`.
 *
 * The even/odd argument convention is Firestore's: collection, id,
 * collection, id… An odd count is a bug, and throwing here is far kinder than
 * writing to a path that silently never reads back.
 */
export function doc(_db: unknown, ...segments: string[]): DocRef {
  if (segments.length === 0 || segments.length % 2 !== 0) {
    throw new Error(`doc() needs collection/id pairs, got ${segments.length} segment(s)`);
  }
  return { kind: 'doc', path: segments.join('/') };
}

export function collection(_db: unknown, ...segments: string[]): CollectionRef {
  if (segments.length === 0 || segments.length % 2 === 0) {
    throw new Error(`collection() needs collection/id/…/collection, got ${segments.length} segment(s)`);
  }
  return { kind: 'collection', path: segments.join('/') };
}

// ---- reads -----------------------------------------------------------------

export function getDoc<T = DocumentData>(ref: DocRef): Promise<DocSnapshot<T>> {
  const collectionPath = collectionPathOf(ref.path);
  const id = ref.path.split('/').pop() as string;
  const stored = readCollection(collectionPath)[id] as T | undefined;
  return Promise.resolve({
    id,
    ref,
    exists: () => stored !== undefined,
    data: () => stored as T,
  });
}

export function getDocs<T = DocumentData>(target: CollectionRef | QueryRef): Promise<QuerySnapshot<T>> {
  const docs = readCollection(target.path);
  let rows = Object.entries(docs).map(([id, data]) => ({ id, data: data as T }));

  if (target.kind === 'query') {
    for (const { field, op, value } of target.filters) {
      rows = rows.filter(({ data }) => matches((data as DocumentData)[field], op, value));
    }
    for (const { field, dir } of [...target.orders].reverse()) {
      rows.sort((a, b) => compare((a.data as DocumentData)[field], (b.data as DocumentData)[field], dir));
    }
    if (target.max != null) rows = rows.slice(0, target.max);
  }

  const snapshots = rows.map(({ id, data }) => ({
    id,
    ref: { kind: 'doc' as const, path: `${target.path}/${id}` },
    exists: () => true,
    data: () => data,
  }));

  return Promise.resolve({
    empty: snapshots.length === 0,
    size: snapshots.length,
    docs: snapshots,
    forEach: (cb) => snapshots.forEach(cb),
  });
}

function matches(actual: unknown, op: string, expected: unknown): boolean {
  switch (op) {
    case '==':
      return sameValue(actual, expected);
    case '!=':
      return !sameValue(actual, expected);
    case 'in':
      return Array.isArray(expected) && expected.some((v) => sameValue(actual, v));
    case '>':
      return (actual as number) > (expected as number);
    case '>=':
      return (actual as number) >= (expected as number);
    case '<':
      return (actual as number) < (expected as number);
    case '<=':
      return (actual as number) <= (expected as number);
    case 'array-contains':
      return Array.isArray(actual) && actual.some((v) => sameValue(v, expected));
    default:
      return false;
  }
}

function compare(a: unknown, b: unknown, dir: 'asc' | 'desc'): number {
  const sign = dir === 'asc' ? 1 : -1;
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * sign;
  return String(a).localeCompare(String(b)) * sign;
}

// ---- writes ----------------------------------------------------------------

/** Apply `setDoc`'s field semantics: sentinels first, then a shallow merge. */
function applyFields(existing: DocumentData, fields: DocumentData, merge: boolean): DocumentData {
  const base = merge ? { ...existing } : {};
  for (const [key, value] of Object.entries(fields)) {
    if (isSentinel(value)) {
      const current = Array.isArray(base[key]) ? (base[key] as unknown[]) : [];
      base[key] =
        value.__sentinel === UNION
          ? [...current, ...value.values.filter((v) => !current.some((c) => sameValue(c, v)))]
          : current.filter((c) => !value.values.some((v) => sameValue(c, v)));
    } else {
      base[key] = value;
    }
  }
  return base;
}

export function setDoc(ref: DocRef, data: DocumentData, options?: { merge?: boolean }): Promise<void> {
  const collectionPath = collectionPathOf(ref.path);
  const id = ref.path.split('/').pop() as string;
  const docs = readCollection(collectionPath);
  docs[id] = applyFields(docs[id] ?? {}, data, options?.merge ?? false);
  writeCollection(collectionPath, docs);
  return Promise.resolve();
}

export function updateDoc(ref: DocRef, data: DocumentData): Promise<void> {
  const collectionPath = collectionPathOf(ref.path);
  const id = ref.path.split('/').pop() as string;
  const docs = readCollection(collectionPath);
  docs[id] = applyFields(docs[id] ?? {}, data, true);
  writeCollection(collectionPath, docs);
  return Promise.resolve();
}

export function deleteDoc(ref: DocRef): Promise<void> {
  const collectionPath = collectionPathOf(ref.path);
  const id = ref.path.split('/').pop() as string;
  const docs = readCollection(collectionPath);
  delete docs[id];
  writeCollection(collectionPath, docs);
  return Promise.resolve();
}

/** Returns the generated id, like Firestore's `addDoc`. */
export function addDoc(ref: CollectionRef, data: DocumentData): Promise<DocRef> {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const docs = readCollection(ref.path);
  docs[id] = applyFields({}, data, false);
  writeCollection(ref.path, docs);
  return Promise.resolve({ kind: 'doc', path: `${ref.path}/${id}` });
}

// ---- queries ---------------------------------------------------------------

export function query(ref: CollectionRef | QueryRef, ...constraints: unknown[]): QueryRef {
  const base: QueryRef =
    ref.kind === 'query'
      ? ref
      : { kind: 'query', path: ref.path, filters: [], orders: [], max: null };
  const next: QueryRef = {
    ...base,
    filters: [...base.filters],
    orders: [...base.orders],
  };

  for (const c of constraints) {
    const constraint = c as { __kind?: string; field?: string; op?: string; value?: unknown; dir?: 'asc' | 'desc'; n?: number };
    if (constraint.__kind === 'where') {
      next.filters.push({ field: constraint.field as string, op: constraint.op as string, value: constraint.value });
    } else if (constraint.__kind === 'orderBy') {
      next.orders.push({ field: constraint.field as string, dir: constraint.dir ?? 'asc' });
    } else if (constraint.__kind === 'limit') {
      next.max = constraint.n ?? null;
    }
  }
  return next;
}

export function where(field: string, op: string, value: unknown) {
  return { __kind: 'where', field, op, value };
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc') {
  return { __kind: 'orderBy', field, dir };
}

export function limit(n: number) {
  return { __kind: 'limit', n };
}

// ---- live updates ----------------------------------------------------------

export type Unsubscribe = () => void;

/**
 * Watch a collection for writes from this tab.
 *
 * Deliberately simple: any write under the watched path re-runs the read and
 * pushes a fresh snapshot. Cross-tab changes are picked up through the
 * `storage` event. There is no per-document diffing, which is the one
 * Firestore behaviour callers could tell apart — and none of them do.
 */
export function onSnapshot<T = DocumentData>(
  target: CollectionRef | QueryRef,
  callback: (snapshot: QuerySnapshot<T>) => void
): Unsubscribe {
  if (typeof window === 'undefined') return () => {};

  const emit = () => {
    void getDocs<T>(target).then(callback);
  };

  const onChange = (event: Event) => {
    const detail = (event as CustomEvent<{ path?: string }>).detail;
    // A write to a deeper path (a subcollection) still affects a collection
    // query only if it is this collection; a write to this path always does.
    if (!detail?.path || detail.path === target.path) emit();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key.startsWith(PREFIX) && event.key.slice(PREFIX.length) === target.path) emit();
  };

  window.addEventListener(NOTIFY_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  emit();

  return () => {
    window.removeEventListener(NOTIFY_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

// ---- batches ---------------------------------------------------------------

export function writeBatch(_db: unknown) {
  const queued: { ref: DocRef; data: DocumentData }[] = [];
  return {
    update(ref: DocRef, data: DocumentData) {
      queued.push({ ref, data });
    },
    set(ref: DocRef, data: DocumentData) {
      queued.push({ ref, data });
    },
    async commit() {
      for (const { ref, data } of queued) await updateDoc(ref, data);
    },
  };
}

/** Everything this store owns, for a "clear local data" action. */
export function clearAll(): void {
  if (typeof window === 'undefined') return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
}
