import { describe, expect, it } from 'vitest';
import {
  formatDuration, sanitizeStopwatch, sanitizeTimer, STOPWATCH_IDLE, swElapsed, swLap, swPause, swReset, swStart,
  timerFinished, timerIdle, timerPause, timerRemaining, timerReset, timerStart,
} from './timeTools';

describe('stopwatch', () => {
  it('counts only while running and survives pauses', () => {
    let s = swStart(STOPWATCH_IDLE, 1000);
    expect(swElapsed(s, 3500)).toBe(2500);
    s = swPause(s, 4000);
    expect(swElapsed(s, 99999)).toBe(3000);
    s = swStart(s, 10000);
    expect(swElapsed(s, 11000)).toBe(4000);
  });
  it('records laps as totals and ignores them when paused', () => {
    let s = swStart(STOPWATCH_IDLE, 0);
    s = swLap(s, 1000);
    s = swLap(s, 2500);
    expect(s.laps).toEqual([1000, 2500]);
    expect(swLap(swPause(s, 3000), 4000).laps).toEqual([1000, 2500]);
  });
  it('starting twice does not reset the start time; reset clears', () => {
    const s = swStart(STOPWATCH_IDLE, 100);
    expect(swStart(s, 500).startedAt).toBe(100);
    expect(swReset()).toEqual(STOPWATCH_IDLE);
  });
  it('never goes negative if the clock moves back', () => {
    expect(swElapsed(swStart(STOPWATCH_IDLE, 5000), 4000)).toBe(0);
  });
});

describe('timer', () => {
  it('counts down from absolute time (tab throttling does not matter)', () => {
    let t = timerStart(timerIdle(60000), 1000);
    expect(timerRemaining(t, 1000)).toBe(60000);
    expect(timerRemaining(t, 31000)).toBe(30000);
    expect(timerFinished(t, 31000)).toBe(false);
    expect(timerRemaining(t, 5_000_000)).toBe(0);
    expect(timerFinished(t, 5_000_000)).toBe(true);
    t = timerPause(timerStart(timerIdle(60000), 0), 20000);
    expect(timerRemaining(t, 999999)).toBe(40000);
    expect(timerStart(t, 50000).endsAt).toBe(90000);
  });
  it('restarts a finished timer and resets to full duration', () => {
    const done = timerPause(timerStart(timerIdle(1000), 0), 5000);
    expect(done.remainingMs).toBe(0);
    expect(timerStart(done, 9000).endsAt).toBe(10000);
    expect(timerReset(done).remainingMs).toBe(1000);
  });
  it('cannot start at zero duration and caps the maximum', () => {
    expect(timerStart(timerIdle(0), 0).running).toBe(false);
    expect(timerIdle(10 ** 12).durationMs).toBeLessThan(10 ** 12);
  });
});

describe('formatDuration', () => {
  it('formats with and without hours and centiseconds', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65000)).toBe('01:05');
    expect(formatDuration(3723000)).toBe('01:02:03');
    expect(formatDuration(1234, true)).toBe('00:01.23');
    expect(formatDuration(-5)).toBe('00:00');
  });
});

describe('saved state', () => {
  it('rejects garbage and keeps good data', () => {
    expect(sanitizeStopwatch('x')).toEqual(STOPWATCH_IDLE);
    expect(sanitizeStopwatch({ running: true, startedAt: 5, accumulatedMs: 10, laps: [1, 'a', -3, 2] })).toEqual({
      running: true, startedAt: 5, accumulatedMs: 10, laps: [1, 2],
    });
    expect(sanitizeStopwatch({ running: true, accumulatedMs: 10 }).running).toBe(false);
    expect(sanitizeTimer(null)).toEqual(timerIdle());
    const t = sanitizeTimer({ durationMs: 1000, running: true, endsAt: 5000, remainingMs: 9999 });
    expect(t.running).toBe(true);
    expect(t.remainingMs).toBe(1000);
  });
});
