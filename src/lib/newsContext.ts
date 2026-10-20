import { useSyncExternalStore } from 'react';

/** A place the user picked in World, offered to Pulse as a search context (used in Phase 4/5). */
export interface NewsPlace {
  name: string;
  country?: string;
  lat: number;
  lon: number;
}

let current: NewsPlace | null = null;
const listeners = new Set<() => void>();

export function setNewsPlace(place: NewsPlace | null): void {
  current = place;
  listeners.forEach((l) => l());
}

export function getNewsPlace(): NewsPlace | null {
  return current;
}

/** Short text for a news search, e.g. "Tokyo, Japan". */
export function newsQuery(place: NewsPlace): string {
  return place.country && place.country !== place.name ? `${place.name}, ${place.country}` : place.name;
}

export function useNewsPlace(): NewsPlace | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getNewsPlace,
    getNewsPlace,
  );
}
