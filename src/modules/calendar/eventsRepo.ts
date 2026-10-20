// Calendar events. Stored in this browser's IndexedDB; if that is unavailable (private mode, blocked)
// events are kept in memory for the visit and the screen says so. Nothing leaves the device.

import { isValidTime, parseDateKey } from './dateUtils';

export interface CalendarEvent {
  id: string;
  title: string;
  /** Local date, "YYYY-MM-DD". */
  date: string;
  /** Optional "HH:mm" (24h). */
  start?: string;
  end?: string;
  notes?: string;
  createdAt: number;
}

export type EventDraft = Omit<CalendarEvent, 'id' | 'createdAt'>;

export interface EventsRepo {
  /** True when events survive closing the browser. */
  persistent: boolean;
  list(): Promise<CalendarEvent[]>;
  put(event: CalendarEvent): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Returns an error message, or null when the draft is fine. */
export function validateDraft(d: EventDraft): string | null {
  if (!d.title.trim()) return 'Give the event a title.';
  if (d.title.trim().length > 120) return 'The title is too long (120 characters at most).';
  if (!parseDateKey(d.date)) return 'Pick a valid date.';
  if (d.start && !isValidTime(d.start)) return 'The start time is not valid.';
  if (d.end && !isValidTime(d.end)) return 'The end time is not valid.';
  if (d.end && !d.start) return 'Add a start time before an end time.';
  if (d.start && d.end && d.end < d.start) return 'The event cannot end before it starts.';
  return null;
}

export function newEventId(): string {
  const c = globalThis.crypto;
  return c && 'randomUUID' in c ? c.randomUUID() : `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Events with no start time first (all-day), then by start time, then by title. */
export function sortEvents(events: readonly CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.start ?? '').localeCompare(b.start ?? '') ||
      a.title.localeCompare(b.title),
  );
}

export function eventsOn(events: readonly CalendarEvent[], dateKey: string): CalendarEvent[] {
  return sortEvents(events.filter((e) => e.date === dateKey));
}

/** The next events from today onwards (today's events that already started still count as today). */
export function upcoming(events: readonly CalendarEvent[], todayKey: string, limit = 5): CalendarEvent[] {
  return sortEvents(events.filter((e) => e.date >= todayKey)).slice(0, limit);
}

export function createMemoryRepo(): EventsRepo {
  const map = new Map<string, CalendarEvent>();
  return {
    persistent: false,
    list: async () => [...map.values()],
    put: async (e) => void map.set(e.id, e),
    remove: async (id) => void map.delete(id),
  };
}

const DB_NAME = 'nexus-calendar';
const STORE = 'events';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('Could not open IndexedDB'));
    open.onblocked = () => reject(new Error('IndexedDB is blocked'));
  });
}

/** Opens the persistent store, or falls back to memory when IndexedDB is not usable. */
export async function openEventsRepo(): Promise<EventsRepo> {
  if (typeof indexedDB === 'undefined') return createMemoryRepo();
  try {
    const db = await openDb();
    const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
    return {
      persistent: true,
      list: async () => (await req(tx('readonly').getAll())) as CalendarEvent[],
      put: async (e) => void (await req(tx('readwrite').put(e))),
      remove: async (id) => void (await req(tx('readwrite').delete(id))),
    };
  } catch {
    return createMemoryRepo();
  }
}

/** Deletes all saved events (used by "Erase all local data"). */
export async function deleteEventsDatabase(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    try {
      const r = indexedDB.deleteDatabase(DB_NAME);
      r.onsuccess = () => resolve();
      r.onerror = () => resolve();
      r.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}
