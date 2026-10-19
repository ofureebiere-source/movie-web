import { useCallback, useEffect, useState } from 'react';
import type { MediaType } from './api';

/**
 * My List, in `localStorage`.
 *
 * Ported from frameXTV.xyz's `MediaCard` chunk. Same key, same 200-entry cap,
 * same `{mediaType,id,title,poster,backdrop,year,savedAt}` shape and same
 * `framextv:watchlist_updated` event, so a viewer's list survives the port.
 */

const STORAGE_KEY = 'framextv_my_list_v1';
const MAX_ENTRIES = 200;

export interface MyListEntry {
  mediaType: MediaType;
  id: string;
  title: string;
  poster?: string;
  backdrop?: string;
  year?: string;
  savedAt: number;
}

export interface MyListInput {
  mediaType: MediaType;
  id: string;
  title: string;
  poster?: string;
  backdrop?: string;
  year?: string;
}

function keyOf(mediaType: string, id: string): string {
  return `${mediaType}:${String(id).trim()}`;
}

function emit(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event('framextv:watchlist_updated'));
  } catch {
    /* no CustomEvent/Event support */
  }
}

/** Every saved entry, newest first. */
export function readMyList(): MyListEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    const entries: MyListEntry[] = [];
    for (const value of parsed) {
      if (!value || typeof value !== 'object') continue;
      const entry = value as Partial<MyListEntry>;
      const mediaType = entry.mediaType;
      const id = typeof entry.id === 'string' ? entry.id.trim() : '';
      const title = typeof entry.title === 'string' ? entry.title.trim() : '';
      if (mediaType !== 'movie' && mediaType !== 'tv' && mediaType !== 'anime') continue;
      if (!id || !title) continue;
      const dedupeKey = keyOf(mediaType, id);
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      entries.push({
        mediaType,
        id,
        title,
        poster: typeof entry.poster === 'string' ? entry.poster : undefined,
        backdrop: typeof entry.backdrop === 'string' ? entry.backdrop : undefined,
        year: typeof entry.year === 'string' ? entry.year : undefined,
        savedAt:
          typeof entry.savedAt === 'number' && !Number.isNaN(entry.savedAt)
            ? entry.savedAt
            : Date.now(),
      });
    }
    return entries.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function isInMyList(mediaType: MediaType, id: string): boolean {
  const target = keyOf(mediaType, id);
  return readMyList().some((entry) => keyOf(entry.mediaType, entry.id) === target);
}

export function addToMyList(input: MyListInput): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const id = String(input.id).trim();
  const title = (input.title || '').trim();
  if (!id || !title) return false;

  const target = keyOf(input.mediaType, id);
  const current = readMyList();
  if (current.some((entry) => keyOf(entry.mediaType, entry.id) === target)) return true;

  const next: MyListEntry[] = [
    {
      mediaType: input.mediaType,
      id,
      title,
      poster: input.poster,
      backdrop: input.backdrop,
      year: input.year,
      savedAt: Date.now(),
    },
    ...current,
  ].slice(0, MAX_ENTRIES);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emit();
    return true;
  } catch {
    return false;
  }
}

export function removeFromMyList(mediaType: MediaType, id: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const target = keyOf(mediaType, id);
  const current = readMyList();
  const next = current.filter((entry) => keyOf(entry.mediaType, entry.id) !== target);
  if (next.length === current.length) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emit();
    return true;
  } catch {
    return false;
  }
}

/** Add if absent, remove if present. Returns whether the entry is now saved. */
export function toggleMyList(input: MyListInput): boolean {
  if (isInMyList(input.mediaType, input.id)) {
    removeFromMyList(input.mediaType, input.id);
    return false;
  }
  addToMyList(input);
  return true;
}

export function clearMyList(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    emit();
  } catch {
    /* disabled */
  }
}

/** Reactive view of My List; re-reads on the same events the reference listens to. */
export function useMyList() {
  const [items, setItems] = useState<MyListEntry[]>(() => readMyList());

  const refresh = useCallback(() => setItems(readMyList()), []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('framextv:watchlist_updated', handler);
    window.addEventListener('storage', handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('framextv:watchlist_updated', handler);
      window.removeEventListener('storage', handler);
      window.removeEventListener('focus', handler);
    };
  }, [refresh]);

  return {
    items,
    isSaved: useCallback((mediaType: MediaType, id: string) => isInMyList(mediaType, id), []),
    toggle: useCallback((input: MyListInput) => toggleMyList(input), []),
    add: useCallback((input: MyListInput) => addToMyList(input), []),
    remove: useCallback((mediaType: MediaType, id: string) => removeFromMyList(mediaType, id), []),
    clear: useCallback(() => clearMyList(), []),
    count: items.length,
  };
}

/** Reactive "is this title saved?" for a single card. */
export function useIsInMyList(mediaType: MediaType, id: string | undefined): boolean {
  const [saved, setSaved] = useState<boolean>(() => (id ? isInMyList(mediaType, id) : false));

  useEffect(() => {
    if (!id) {
      setSaved(false);
      return;
    }
    const handler = () => setSaved(isInMyList(mediaType, id));
    handler();
    window.addEventListener('framextv:watchlist_updated', handler);
    window.addEventListener('storage', handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('framextv:watchlist_updated', handler);
      window.removeEventListener('storage', handler);
      window.removeEventListener('focus', handler);
    };
  }, [mediaType, id]);

  return saved;
}
