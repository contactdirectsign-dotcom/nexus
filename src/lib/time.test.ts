import { describe, expect, it } from 'vitest';
import { deviceTimeZone, formatTime } from './time';
import { parseRoute } from './useHashRoute';

describe('formatTime', () => {
  // 2026-01-15 10:30 UTC is 16:00 in Asia/Kolkata (UTC+5:30, no daylight saving)
  const d = new Date(Date.UTC(2026, 0, 15, 10, 30));

  it('uses the IANA time zone, not longitude guesses', () => {
    expect(formatTime(d, '24h', 'Asia/Kolkata')).toContain('16:00');
  });

  it('handles daylight saving: New York is UTC-5 in January and UTC-4 in July', () => {
    const jan = new Date(Date.UTC(2026, 0, 15, 12, 0));
    const jul = new Date(Date.UTC(2026, 6, 15, 12, 0));
    expect(formatTime(jan, '24h', 'America/New_York')).toContain('07:00');
    expect(formatTime(jul, '24h', 'America/New_York')).toContain('08:00');
  });

  it('switches between 12-hour and 24-hour', () => {
    expect(formatTime(d, '12h', 'Asia/Kolkata').toLowerCase()).toMatch(/pm/);
    expect(formatTime(d, '24h', 'Asia/Kolkata').toLowerCase()).not.toMatch(/pm/);
  });
});

describe('deviceTimeZone', () => {
  it('returns a non-empty string', () => {
    expect(deviceTimeZone().length).toBeGreaterThan(0);
  });
});

describe('parseRoute', () => {
  it('parses known routes', () => {
    expect(parseRoute('#/world')).toBe('world');
    expect(parseRoute('#pulse')).toBe('pulse');
    expect(parseRoute('#/settings')).toBe('settings');
  });
  it('falls back to the dashboard for unknown or empty hashes', () => {
    expect(parseRoute('')).toBe('dashboard');
    expect(parseRoute('#/nope')).toBe('dashboard');
  });
});
