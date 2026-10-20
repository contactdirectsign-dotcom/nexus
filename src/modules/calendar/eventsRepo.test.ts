import { describe, expect, it } from 'vitest';
import { createMemoryRepo, eventsOn, newEventId, sortEvents, upcoming, validateDraft, type CalendarEvent } from './eventsRepo';

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: newEventId(),
  title: 'Event',
  date: '2026-10-19',
  createdAt: 1,
  ...over,
});

describe('validateDraft', () => {
  it('accepts a good event', () => {
    expect(validateDraft({ title: 'Dentist', date: '2026-10-20', start: '09:00', end: '09:30' })).toBeNull();
    expect(validateDraft({ title: 'All day', date: '2026-10-20' })).toBeNull();
  });
  it('explains what is wrong', () => {
    expect(validateDraft({ title: '  ', date: '2026-10-20' })).toMatch(/title/);
    expect(validateDraft({ title: 'x'.repeat(121), date: '2026-10-20' })).toMatch(/too long/);
    expect(validateDraft({ title: 'x', date: '2026-02-31' })).toMatch(/date/);
    expect(validateDraft({ title: 'x', date: '2026-10-20', start: '25:00' })).toMatch(/start/);
    expect(validateDraft({ title: 'x', date: '2026-10-20', end: '10:00' })).toMatch(/start time/);
    expect(validateDraft({ title: 'x', date: '2026-10-20', start: '10:00', end: '09:00' })).toMatch(/end before/);
  });
});

describe('ordering', () => {
  it('sorts by date, all-day first, then time', () => {
    const a = ev({ title: 'B', date: '2026-10-20', start: '08:00' });
    const b = ev({ title: 'A', date: '2026-10-20' });
    const c = ev({ title: 'C', date: '2026-10-19', start: '23:00' });
    expect(sortEvents([a, b, c]).map((e) => e.title)).toEqual(['C', 'A', 'B']);
  });
  it('filters a day and finds upcoming events', () => {
    const list = [ev({ title: 'old', date: '2026-10-01' }), ev({ title: 'today', date: '2026-10-19' }), ev({ title: 'later', date: '2026-11-01' })];
    expect(eventsOn(list, '2026-10-19').map((e) => e.title)).toEqual(['today']);
    expect(upcoming(list, '2026-10-19').map((e) => e.title)).toEqual(['today', 'later']);
    expect(upcoming(list, '2026-10-19', 1)).toHaveLength(1);
  });
});

describe('memory repo', () => {
  it('creates, edits and deletes', async () => {
    const repo = createMemoryRepo();
    expect(repo.persistent).toBe(false);
    const e = ev({ title: 'One' });
    await repo.put(e);
    await repo.put({ ...e, title: 'Renamed' });
    expect((await repo.list()).map((x) => x.title)).toEqual(['Renamed']);
    await repo.remove(e.id);
    expect(await repo.list()).toEqual([]);
  });
  it('generates distinct ids', () => {
    expect(newEventId()).not.toBe(newEventId());
  });
});
