import { describe, expect, it } from 'vitest';
import { describeDifference, formatOffset, isDaytimeAt, isValidTimeZone, utcOffsetMinutes } from './timezones';

describe('utcOffsetMinutes', () => {
  it('knows fixed and half-hour offsets', () => {
    const d = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
    expect(utcOffsetMinutes('UTC', d)).toBe(0);
    expect(utcOffsetMinutes('Asia/Kolkata', d)).toBe(330);
    expect(utcOffsetMinutes('Asia/Kathmandu', d)).toBe(345);
    expect(utcOffsetMinutes('Asia/Tokyo', d)).toBe(540);
  });

  it('follows daylight saving time', () => {
    const jan = new Date(Date.UTC(2026, 0, 15, 12));
    const jul = new Date(Date.UTC(2026, 6, 15, 12));
    expect(utcOffsetMinutes('America/New_York', jan)).toBe(-300);
    expect(utcOffsetMinutes('America/New_York', jul)).toBe(-240);
    expect(utcOffsetMinutes('Europe/London', jan)).toBe(0);
    expect(utcOffsetMinutes('Europe/London', jul)).toBe(60);
    // southern hemisphere is reversed
    expect(utcOffsetMinutes('Australia/Sydney', jan)).toBe(660);
    expect(utcOffsetMinutes('Australia/Sydney', jul)).toBe(600);
  });

  it('handles the exact moment of a daylight-saving change', () => {
    // US spring forward 2026: 2026-03-08 07:00 UTC (02:00 EST -> 03:00 EDT)
    expect(utcOffsetMinutes('America/New_York', new Date(Date.UTC(2026, 2, 8, 6, 59, 59)))).toBe(-300);
    expect(utcOffsetMinutes('America/New_York', new Date(Date.UTC(2026, 2, 8, 7, 0, 0)))).toBe(-240);
  });
});

describe('formatting', () => {
  it('formats offsets', () => {
    expect(formatOffset(330)).toBe('UTC+05:30');
    expect(formatOffset(-240)).toBe('UTC-04:00');
    expect(formatOffset(0)).toBe('UTC+00:00');
  });

  it('describes differences from the device', () => {
    expect(describeDifference(330, 330)).toBe('Same time as you');
    expect(describeDifference(540, 330)).toBe('3h 30m ahead of you');
    expect(describeDifference(-300, 330)).toBe('10h 30m behind you');
    expect(describeDifference(60, 0)).toBe('1h ahead of you');
  });
});

describe('time zone validation and day/night', () => {
  it('validates IANA names', () => {
    expect(isValidTimeZone('Asia/Tokyo')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });

  it('tells day from night locally', () => {
    const noonUtc = new Date(Date.UTC(2026, 5, 1, 12, 0));
    expect(isDaytimeAt('UTC', noonUtc)).toBe(true);
    expect(isDaytimeAt('Asia/Tokyo', noonUtc)).toBe(false); // 21:00 in Tokyo
  });
});
