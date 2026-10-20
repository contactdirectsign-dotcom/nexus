// Time-zone helpers built on the browser's IANA time-zone database (Intl). No longitude guessing,
// and daylight-saving changes are handled by the platform.

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Offset of a time zone from UTC, in minutes, at a given moment (east of UTC is positive). */
export function utcOffsetMinutes(timeZone: string, at: Date): number {
  const parts = partsFormatter(timeZone).formatToParts(at);
  const n = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const hour = n('hour') === 24 ? 0 : n('hour');
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), hour, n('minute'), n('second'));
  const real = Math.floor(at.getTime() / 1000) * 1000;
  return Math.round((asUtc - real) / 60000);
}

/** "UTC+05:30", "UTC-04:00", "UTC+00:00". */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const h = String(Math.floor(abs / 60)).padStart(2, '0');
  const m = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${h}:${m}`;
}

/** "3h 30m ahead of you", "5h behind you" or "Same time as you". */
export function describeDifference(zoneMinutes: number, deviceMinutes: number): string {
  const diff = zoneMinutes - deviceMinutes;
  if (diff === 0) return 'Same time as you';
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const text = [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ');
  return `${text} ${diff > 0 ? 'ahead of' : 'behind'} you`;
}

/** Short day/night hint from the local hour of a place (for a small icon only). */
export function isDaytimeAt(timeZone: string, at: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(at),
  );
  return hour >= 6 && hour < 18;
}
