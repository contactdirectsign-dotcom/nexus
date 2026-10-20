import { describe, expect, it } from 'vitest';
import { addDays, addMonths, isSameDay, isValidTime, monthGrid, parseDateKey, startOfWeek, toDateKey, weekDays } from './dateUtils';

describe('date keys', () => {
  it('round-trips and rejects impossible dates', () => {
    expect(toDateKey(new Date(2026, 9, 5))).toBe('2026-10-05');
    expect(parseDateKey('2026-10-05')?.getDate()).toBe(5);
    expect(parseDateKey('2026-02-30')).toBeNull();
    expect(parseDateKey('2026-13-01')).toBeNull();
    expect(parseDateKey('nope')).toBeNull();
    expect(parseDateKey('2028-02-29')).not.toBeNull(); // leap day
    expect(parseDateKey('2027-02-29')).toBeNull();
  });
});

describe('moving around', () => {
  it('adds days across month and year ends', () => {
    expect(toDateKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
    expect(toDateKey(addDays(new Date(2026, 2, 1), -1))).toBe('2026-02-28');
  });
  it('clamps the day when adding months', () => {
    expect(toDateKey(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28');
    expect(toDateKey(addMonths(new Date(2028, 0, 31), 1))).toBe('2028-02-29');
    expect(toDateKey(addMonths(new Date(2026, 11, 15), 1))).toBe('2027-01-15');
    expect(toDateKey(addMonths(new Date(2026, 0, 15), -1))).toBe('2025-12-15');
  });
  it('weeks start on Monday', () => {
    // 19 Oct 2026 is a Monday
    expect(toDateKey(startOfWeek(new Date(2026, 9, 19)))).toBe('2026-10-19');
    expect(toDateKey(startOfWeek(new Date(2026, 9, 25)))).toBe('2026-10-19'); // Sunday
    expect(weekDays(new Date(2026, 9, 21)).map((d) => d.getDate())).toEqual([19, 20, 21, 22, 23, 24, 25]);
  });
});

describe('monthGrid', () => {
  it('has 42 days, starts on a Monday and contains the whole month', () => {
    const grid = monthGrid(2026, 9);
    expect(grid).toHaveLength(42);
    expect((grid[0].getDay() + 6) % 7).toBe(0);
    const inMonth = grid.filter((d) => d.getMonth() === 9);
    expect(inMonth).toHaveLength(31);
    expect(isSameDay(inMonth[0], new Date(2026, 9, 1))).toBe(true);
  });
  it('works when the 1st is a Monday', () => {
    const grid = monthGrid(2026, 5); // 1 June 2026 is a Monday
    expect(toDateKey(grid[0])).toBe('2026-06-01');
  });
});

describe('isValidTime', () => {
  it('accepts 24h times only', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:30')).toBe(false);
    expect(isValidTime('12:60')).toBe(false);
  });
});
