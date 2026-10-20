// Timer and stopwatch as small pure state machines based on timestamps (not on counting ticks), so they
// stay correct when the tab is throttled or the screen sleeps. State is saved so a refresh keeps it.
//
// Honest limit: a browser tab cannot be woken to ring when it is closed or the phone is locked.
// The timer shows "finished" (and rings) the moment the app is open again.

export interface StopwatchState {
  running: boolean;
  startedAt: number | null;
  accumulatedMs: number;
  laps: number[]; // total elapsed at each lap, oldest first
}

export const STOPWATCH_IDLE: StopwatchState = { running: false, startedAt: null, accumulatedMs: 0, laps: [] };

export function swElapsed(s: StopwatchState, now: number): number {
  return s.accumulatedMs + (s.running && s.startedAt !== null ? Math.max(0, now - s.startedAt) : 0);
}
export function swStart(s: StopwatchState, now: number): StopwatchState {
  return s.running ? s : { ...s, running: true, startedAt: now };
}
export function swPause(s: StopwatchState, now: number): StopwatchState {
  return s.running ? { ...s, running: false, startedAt: null, accumulatedMs: swElapsed(s, now) } : s;
}
export function swLap(s: StopwatchState, now: number): StopwatchState {
  return s.running ? { ...s, laps: [...s.laps, swElapsed(s, now)] } : s;
}
export function swReset(): StopwatchState {
  return STOPWATCH_IDLE;
}

export interface TimerState {
  durationMs: number;
  running: boolean;
  /** Absolute end time while running. */
  endsAt: number | null;
  /** Time left while paused (or the full duration when idle). */
  remainingMs: number;
}

export const MAX_TIMER_MS = 99 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000;

export function timerIdle(durationMs = 5 * 60 * 1000): TimerState {
  const d = Math.min(MAX_TIMER_MS, Math.max(0, Math.round(durationMs)));
  return { durationMs: d, running: false, endsAt: null, remainingMs: d };
}
export function timerRemaining(s: TimerState, now: number): number {
  return s.running && s.endsAt !== null ? Math.max(0, s.endsAt - now) : s.remainingMs;
}
export function timerFinished(s: TimerState, now: number): boolean {
  return s.durationMs > 0 && timerRemaining(s, now) === 0 && (s.running || s.remainingMs === 0);
}
export function timerSetDuration(durationMs: number): TimerState {
  return timerIdle(durationMs);
}
export function timerStart(s: TimerState, now: number): TimerState {
  if (s.running || s.durationMs <= 0) return s;
  const left = s.remainingMs > 0 ? s.remainingMs : s.durationMs; // starting a finished timer restarts it
  return { ...s, running: true, endsAt: now + left, remainingMs: left };
}
export function timerPause(s: TimerState, now: number): TimerState {
  return s.running ? { ...s, running: false, endsAt: null, remainingMs: timerRemaining(s, now) } : s;
}
export function timerReset(s: TimerState): TimerState {
  return timerIdle(s.durationMs);
}

/** "01:02:03" (or "02:03" under an hour). With `centis`, adds ".45". */
export function formatDuration(ms: number, centis = false): string {
  const total = Math.max(0, Math.floor(ms));
  const cs = Math.floor((total % 1000) / 10);
  const s = Math.floor(total / 1000) % 60;
  const m = Math.floor(total / 60000) % 60;
  const h = Math.floor(total / 3600000);
  const p = (n: number) => String(n).padStart(2, '0');
  const base = h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  return centis ? `${base}.${p(cs)}` : base;
}

const KEY_SW = 'nexus.world.stopwatch.v1';
const KEY_TIMER = 'nexus.world.timer.v1';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

export function sanitizeStopwatch(raw: unknown): StopwatchState {
  if (typeof raw !== 'object' || raw === null) return STOPWATCH_IDLE;
  const r = raw as Record<string, unknown>;
  if (!isNum(r.accumulatedMs)) return STOPWATCH_IDLE;
  const laps = Array.isArray(r.laps) ? r.laps.filter(isNum).slice(-200) : [];
  const running = r.running === true && isNum(r.startedAt);
  return { running, startedAt: running ? (r.startedAt as number) : null, accumulatedMs: r.accumulatedMs, laps };
}

export function sanitizeTimer(raw: unknown): TimerState {
  if (typeof raw !== 'object' || raw === null) return timerIdle();
  const r = raw as Record<string, unknown>;
  if (!isNum(r.durationMs) || !isNum(r.remainingMs)) return timerIdle();
  const base = timerIdle(r.durationMs);
  const running = r.running === true && isNum(r.endsAt);
  return running
    ? { ...base, running: true, endsAt: r.endsAt as number, remainingMs: Math.min(base.durationMs, r.remainingMs) }
    : { ...base, remainingMs: Math.min(base.durationMs, r.remainingMs) };
}

function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* works for this visit only */
  }
}

export const loadStopwatch = (): StopwatchState => sanitizeStopwatch(read(KEY_SW));
export const saveStopwatch = (s: StopwatchState): void => write(KEY_SW, s);
export const loadTimer = (): TimerState => sanitizeTimer(read(KEY_TIMER));
export const saveTimer = (s: TimerState): void => write(KEY_TIMER, s);
