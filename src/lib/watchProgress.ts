import { useCallback, useEffect, useState } from 'react';
import type { MediaType } from './api';

/**
 * Watch progress, in `localStorage`.
 *
 * Ported from frameXTV.xyz's `watchProgress` chunk: same key, same per-episode
 * key shape (`tv:ID:sN:eM`), same "completed at 92%" rule, same 30-entry /
 * 45-day retention window and same `framextv:progress_updated` event.
 */

const STORAGE_KEY = 'framextv_watch_progress_v1';
const COMPLETE_RATIO = 0.92;
const RETENTION_MS = 45 * 24 * 60 * 60 * 1000; // 45 days
const MAX_ENTRIES = 30;

export interface ProgressEntry {
  mediaType: MediaType;
  id: string;
  title?: string;
  poster?: string;
  year?: string;
  season?: number;
  episode?: number;
  timestamp: number;
  duration: number;
  completed: boolean;
  updatedAt?: number;
}

function keyOf(mediaType: string, id: string, season?: number, episode?: number): string {
  const clean = String(id).trim();
  if (mediaType === 'tv') return `tv:${clean}:s${season || 1}:e${episode || 1}`;
  if (mediaType === 'anime') return `anime:${clean}:e${episode || 1}`;
  return `movie:${clean}`;
}

function emit(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event('framextv:progress_updated'));
  } catch {
    /* no Event support */
  }
}

export function readProgress(): ProgressEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is ProgressEntry => {
      if (!value || typeof value !== 'object') return false;
      const entry = value as Partial<ProgressEntry>;
      return (
        typeof entry.id === 'string' &&
        (entry.mediaType === 'movie' || entry.mediaType === 'tv' || entry.mediaType === 'anime') &&
        typeof entry.timestamp === 'number' &&
        !Number.isNaN(entry.timestamp) &&
        typeof entry.duration === 'number' &&
        !Number.isNaN(entry.duration)
      );
    });
  } catch {
    return [];
  }
}

/** The progress row for one exact movie / season+episode, or null. */
export function getProgress(
  mediaType: MediaType,
  id: string,
  season?: number,
  episode?: number
): ProgressEntry | null {
  if (!id) return null;
  const target = keyOf(mediaType, id, season, episode);
  return (
    readProgress().find(
      (entry) => keyOf(entry.mediaType, entry.id, entry.season, entry.episode) === target
    ) || null
  );
}

/** The newest progress row for a title, regardless of episode. */
export function getLatestForTitle(mediaType: MediaType, id: string): ProgressEntry | null {
  if (!id) return null;
  const clean = String(id).trim();
  const matches = readProgress().filter(
    (entry) => entry.mediaType === mediaType && String(entry.id).trim() === clean
  );
  return matches.length ? matches[0] : null;
}

/**
 * The Continue Watching row.
 *
 * One entry per series (the newest), movies individually, and nothing that is
 * finished or barely started (< 15s).
 */
export function getContinueWatching(): ProgressEntry[] {
  const entries = readProgress();
  const seen = new Set<string>();
  const out: ProgressEntry[] = [];
  for (const entry of entries) {
    if (entry.completed || entry.timestamp < 15) continue;
    const groupKey = `${entry.mediaType}:${String(entry.id).trim()}`;
    if (entry.mediaType === 'tv' || entry.mediaType === 'anime') {
      if (seen.has(groupKey)) continue;
      seen.add(groupKey);
    }
    out.push(entry);
  }
  return out;
}

/** "1h 12m left" / "24 min left" / "< 1 min left". */
export function formatRemaining(entry: ProgressEntry | null): string {
  if (!entry || !entry.duration || Number.isNaN(entry.duration) || entry.duration <= 0) return '';
  if (entry.duration <= entry.timestamp) return '';
  const remainingSeconds = Math.max(0, entry.duration - entry.timestamp);
  const minutes = Math.ceil(remainingSeconds / 60);
  if (minutes <= 1) return '< 1 min left';
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `${hours}h ${rest}m left` : `${hours}h left`;
  }
  return `${minutes} min left`;
}

/** `m:ss`, or `h:mm:ss` past an hour. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(secs)}`;
  return `${minutes}:${pad(secs)}`;
}

export interface ProgressInput {
  mediaType: MediaType;
  id: string;
  title?: string;
  poster?: string;
  year?: string;
  season?: number;
  episode?: number;
  timestamp: number;
  duration: number;
  completed?: boolean;
}

export function saveProgress(input: ProgressInput): void {
  if (typeof window === 'undefined' || !window.localStorage || !input.id) return;
  try {
    const current = readProgress();
    const target = keyOf(input.mediaType, input.id, input.season, input.episode);
    const completed =
      Boolean(input.completed) ||
      (input.duration > 0 && input.timestamp / input.duration >= COMPLETE_RATIO);
    const entry: ProgressEntry = { ...input, completed, updatedAt: Date.now() };
    const next = current.filter(
      (existing) =>
        keyOf(existing.mediaType, existing.id, existing.season, existing.episode) !== target
    );
    next.unshift(entry);
    const now = Date.now();
    const retained = next
      .filter((existing) => now - (existing.updatedAt || 0) < RETENTION_MS)
      .slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(retained));
    emit();
  } catch {
    /* quota / disabled */
  }
}

export function removeProgress(
  mediaType: MediaType,
  id: string,
  season?: number,
  episode?: number
): void {
  if (typeof window === 'undefined' || !window.localStorage || !id) return;
  try {
    const target = keyOf(mediaType, id, season, episode);
    const next = readProgress().filter(
      (entry) => keyOf(entry.mediaType, entry.id, entry.season, entry.episode) !== target
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emit();
  } catch {
    /* disabled */
  }
}

export function clearAllProgress(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    emit();
  } catch {
    /* disabled */
  }
}

/** Reactive Continue Watching list. */
export function useContinueWatching(): { items: ProgressEntry[]; refresh: () => void } {
  const [items, setItems] = useState<ProgressEntry[]>(() => getContinueWatching());
  const refresh = useCallback(() => setItems(getContinueWatching()), []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('framextv:progress_updated', handler);
    window.addEventListener('storage', handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('framextv:progress_updated', handler);
      window.removeEventListener('storage', handler);
      window.removeEventListener('focus', handler);
    };
  }, [refresh]);

  return { items, refresh };
}

/** Reactive watch history (all entries, newest first). */
export function useWatchHistory(): { items: ProgressEntry[]; refresh: () => void } {
  const [items, setItems] = useState<ProgressEntry[]>(() => readProgress());
  const refresh = useCallback(() => setItems(readProgress()), []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('framextv:progress_updated', handler);
    window.addEventListener('storage', handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('framextv:progress_updated', handler);
      window.removeEventListener('storage', handler);
      window.removeEventListener('focus', handler);
    };
  }, [refresh]);

  return { items, refresh };
}
