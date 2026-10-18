import { useEffect, useState } from 'react';
import type { TimeFormat } from '../storage/settings';

/** The device's IANA time zone, e.g. "Asia/Calcutta". Uses the platform database, not guesses. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function formatTime(date: Date, format: TimeFormat, timeZone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: format === '12h',
    timeZone,
  }).format(date);
}

export function formatDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(date);
}

/** Re-renders every `intervalMs` with the current time. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
