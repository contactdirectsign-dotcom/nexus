import { useSyncExternalStore } from 'react';
import { isValidTimeZone } from '../lib/timezones';

/** A saved city for the world clock. Stored in this browser only. */
export interface Favorite {
  id: string;
  name: string;
  country?: string;
  lat: number;
  lon: number;
  /** IANA time zone, e.g. "Asia/Tokyo". */
  timezone: string;
}

export const FAVORITES_KEY = 'nexus.world.favorites.v1';
export const MAX_FAVORITES = 12;

export function sanitizeFavorites(raw: unknown): Favorite[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Favorite[] = [];
  for (const r of raw) {
    if (typeof r !== 'object' || r === null) continue;
    const f = r as Record<string, unknown>;
    if (
      typeof f.id !== 'string' ||
      typeof f.name !== 'string' ||
      typeof f.lat !== 'number' ||
      typeof f.lon !== 'number' ||
      typeof f.timezone !== 'string' ||
      !isValidTimeZone(f.timezone) ||
      seen.has(f.id)
    )
      continue;
    seen.add(f.id);
    out.push({
      id: f.id,
      name: f.name,
      country: typeof f.country === 'string' ? f.country : undefined,
      lat: f.lat,
      lon: f.lon,
      timezone: f.timezone,
    });
    if (out.length >= MAX_FAVORITES) break;
  }
  return out;
}

function load(): Favorite[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    return raw ? sanitizeFavorites(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

let current: Favorite[] = load();
const listeners = new Set<() => void>();

function commit(next: Favorite[]): void {
  current = next;
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: favourites last for this visit only
  }
  listeners.forEach((l) => l());
}

export function getFavorites(): Favorite[] {
  return current;
}

/** Returns false when the list is full or the time zone is invalid. Adding an existing city does nothing. */
export function addFavorite(f: Favorite): boolean {
  if (current.some((x) => x.id === f.id)) return true;
  if (current.length >= MAX_FAVORITES || !isValidTimeZone(f.timezone)) return false;
  commit([...current, f]);
  return true;
}

export function removeFavorite(id: string): void {
  commit(current.filter((f) => f.id !== id));
}

/** Reload from storage (after erasing data, and in tests). */
export function reloadFavorites(): void {
  current = load();
  listeners.forEach((l) => l());
}

export function useFavorites(): Favorite[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getFavorites,
    getFavorites,
  );
}
