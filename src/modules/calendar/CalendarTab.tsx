import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Badge, Button, EmptyState, Panel } from '../../design/ui';
import { registerActionHandler } from '../../gestures/actionRegistry';
import { formatTime, useNow } from '../../lib/time';
import { addDays, addMonths, isSameDay, monthGrid, startOfDay, toDateKey, weekDays } from './dateUtils';
import {
  eventsOn, newEventId, openEventsRepo, sortEvents, upcoming, validateDraft,
  type CalendarEvent, type EventDraft, type EventsRepo,
} from './eventsRepo';
import { useSettings } from '../../storage/settings';

type View = 'month' | 'week' | 'day';
const VIEWS: View[] = ['month', 'week', 'day'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const inputClass = 'min-h-11 w-full rounded-xl border border-nx-line bg-nx-surface px-3 text-sm text-nx-text';

function timeLabel(e: CalendarEvent, format: '12h' | '24h'): string {
  if (!e.start) return 'All day';
  const at = (t: string) => formatTime(new Date(2000, 0, 1, Number(t.slice(0, 2)), Number(t.slice(3, 5))), format);
  return e.end ? `${at(e.start)} – ${at(e.end)}` : at(e.start);
}

function EventForm({
  initial, date, onSave, onCancel,
}: {
  initial?: CalendarEvent;
  date: Date;
  onSave: (draft: EventDraft) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [day, setDay] = useState(initial?.date ?? toDateKey(date));
  const [start, setStart] = useState(initial?.start ?? '');
  const [end, setEnd] = useState(initial?.end ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const draft: EventDraft = { title: title.trim(), date: day, start: start || undefined, end: end || undefined, notes: notes.trim() || undefined };
    const problem = validateDraft(draft);
    if (problem) setError(problem);
    else onSave(draft);
  };

  return (
    <form onSubmit={submit} className="grid gap-3" aria-label={initial ? 'Edit event' : 'New event'}>
      <label className="text-sm">
        Title
        <input className={`${inputClass} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-3 text-sm sm:col-span-1">
          Date
          <input type="date" className={`${inputClass} mt-1`} value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label className="text-sm">
          Start
          <input type="time" className={`${inputClass} mt-1`} value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="text-sm">
          End
          <input type="time" className={`${inputClass} mt-1`} value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <label className="text-sm">
        Notes (optional)
        <textarea className={`${inputClass} mt-1 min-h-20 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </label>
      {error && (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary">{initial ? 'Save changes' : 'Add event'}</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

export function CalendarTab() {
  const settings = useSettings();
  const now = useNow(30_000);
  const today = startOfDay(now);
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));
  const [view, setView] = useState<View>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [repo, setRepo] = useState<EventsRepo | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const repoRef = useRef<EventsRepo | null>(null);

  useEffect(() => {
    let live = true;
    openEventsRepo()
      .then(async (r) => {
        repoRef.current = r;
        const list = await r.list();
        if (!live) return;
        setRepo(r);
        setEvents(list);
      })
      .catch(() => live && setProblem('Could not load your events.'));
    return () => {
      live = false;
    };
  }, []);

  const move = useCallback((dir: 1 | -1) => {
    setCursor((c) => (view === 'month' ? addMonths(c, dir) : addDays(c, dir * (view === 'week' ? 7 : 1))));
  }, [view]);

  // Gestures: next/previous panel moves through the calendar while this tab is open.
  useEffect(() => {
    const offs = [
      registerActionHandler('next-panel', () => (move(1), true)),
      registerActionHandler('previous-panel', () => (move(-1), true)),
    ];
    return () => offs.forEach((off) => off());
  }, [move]);

  const save = async (draft: EventDraft) => {
    const r = repoRef.current;
    if (!r) return;
    const event: CalendarEvent =
      editing && editing !== 'new' ? { ...editing, ...draft } : { ...draft, id: newEventId(), createdAt: Date.now() };
    try {
      await r.put(event);
      setEvents((list) => [...list.filter((e) => e.id !== event.id), event]);
      setEditing(null);
      setProblem(null);
    } catch {
      setProblem('Could not save the event. Your browser may be blocking storage.');
    }
  };

  const remove = async (id: string) => {
    try {
      await repoRef.current?.remove(id);
      setEvents((list) => list.filter((e) => e.id !== id));
      setConfirmDelete(null);
    } catch {
      setProblem('Could not delete the event.');
    }
  };

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) map.set(e.date, (map.get(e.date) ?? 0) + 1);
    return map;
  }, [events]);

  const title =
    view === 'month'
      ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `Week of ${weekDays(cursor)[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
        : cursor.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const renderDay = (d: Date) => {
    const key = toDateKey(d);
    const count = byDay.get(key) ?? 0;
    const selected = isSameDay(d, cursor);
    const isToday = isSameDay(d, today);
    const dim = view === 'month' && d.getMonth() !== cursor.getMonth();
    return (
      <button
        key={key}
        type="button"
        onClick={() => setCursor(d)}
        aria-label={`${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}${count ? `, ${count} event${count > 1 ? 's' : ''}` : ''}`}
        aria-pressed={selected}
        className={`relative flex min-h-11 flex-col items-center justify-center rounded-lg border text-sm ${
          selected ? 'border-nx-pink bg-nx-pink/20' : isToday ? 'border-nx-pink/60' : 'border-transparent hover:border-nx-line'
        } ${dim ? 'text-nx-muted/50' : ''}`}
      >
        <span>{d.getDate()}</span>
        {count > 0 && <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-nx-pink" aria-hidden="true" />}
      </button>
    );
  };

  const dayEvents = eventsOn(events, toDateKey(cursor));
  const next = upcoming(events, toDateKey(today), 5);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Panel
          title="Calendar"
          action={
            repo && !repo.persistent ? <Badge tone="warn">Not saved after you close the tab</Badge> : <Badge tone="ok">Saved on this device</Badge>
          }
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1" role="group" aria-label="Change period">
              <Button aria-label="Previous" onClick={() => move(-1)}>‹</Button>
              <Button onClick={() => setCursor(startOfDay(new Date()))}>Today</Button>
              <Button aria-label="Next" onClick={() => move(1)}>›</Button>
            </div>
            <div className="flex gap-1" role="group" aria-label="View">
              {VIEWS.map((v) => (
                <Button key={v} variant={v === view ? 'primary' : 'ghost'} aria-pressed={v === view} onClick={() => setView(v)} className="capitalize">
                  {v}
                </Button>
              ))}
            </div>
          </div>
          <h3 className="mb-2 font-display text-lg font-semibold" aria-live="polite">{title}</h3>

          {view === 'month' && (
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="pb-1 text-center text-xs text-nx-muted">{w}</div>
              ))}
              {monthGrid(cursor.getFullYear(), cursor.getMonth()).map((d) => (
                renderDay(d)
              ))}
            </div>
          )}
          {view === 'week' && (
            <ul className="space-y-2">
              {weekDays(cursor).map((d) => {
                const list = eventsOn(events, toDateKey(d));
                return (
                  <li key={toDateKey(d)} className={`rounded-xl border p-2 ${isSameDay(d, cursor) ? 'border-nx-pink' : 'border-nx-line'}`}>
                    <button type="button" onClick={() => setCursor(d)} className="font-medium hover:text-nx-pink">
                      {d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                      {isSameDay(d, today) && <span className="ml-2 text-xs text-nx-pink">today</span>}
                    </button>
                    {list.length === 0 ? (
                      <p className="text-xs text-nx-muted">Nothing planned</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-sm">
                        {list.map((e) => (
                          <li key={e.id}>
                            <span className="text-nx-muted">{timeLabel(e, settings.timeFormat)}</span> {e.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {view === 'day' && (
            dayEvents.length === 0 ? (
              <EmptyState title="Nothing planned for this day">Add an event with the button below.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {dayEvents.map((e) => (
                  <li key={e.id} className="rounded-xl border border-nx-line p-3">
                    <div className="text-xs text-nx-muted">{timeLabel(e, settings.timeFormat)}</div>
                    <div className="font-medium">{e.title}</div>
                    {e.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-nx-muted">{e.notes}</p>}
                  </li>
                ))}
              </ul>
            )
          )}
          <p className="mt-3 text-xs text-nx-muted">Weeks start on Monday. Gesture actions Next/Previous panel move to the next or previous {view}.</p>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        {problem && <p className="rounded-xl border border-red-500/50 p-3 text-sm text-red-300" role="alert">{problem}</p>}
        <Panel title={cursor.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} action={<Button variant="primary" onClick={() => setEditing('new')}>Add event</Button>}>
          {editing ? (
            <EventForm
              key={editing === 'new' ? 'new' : editing.id}
              initial={editing === 'new' ? undefined : editing}
              date={cursor}
              onSave={(d) => void save(d)}
              onCancel={() => setEditing(null)}
            />
          ) : dayEvents.length === 0 ? (
            <p className="text-sm text-nx-muted">No events on this day.</p>
          ) : (
            <ul className="space-y-2">
              {dayEvents.map((e) => (
                <li key={e.id} className="rounded-xl border border-nx-line p-3">
                  <div className="text-xs text-nx-muted">{timeLabel(e, settings.timeFormat)}</div>
                  <div className="font-medium">{e.title}</div>
                  {e.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-nx-muted">{e.notes}</p>}
                  <div className="mt-2 flex gap-2">
                    <Button className="min-h-9 px-3 text-xs" onClick={() => setEditing(e)} aria-label={`Edit ${e.title}`}>Edit</Button>
                    {confirmDelete === e.id ? (
                      <>
                        <Button variant="danger" className="min-h-9 px-3 text-xs" onClick={() => void remove(e.id)}>Confirm delete</Button>
                        <Button className="min-h-9 px-3 text-xs" onClick={() => setConfirmDelete(null)}>Keep</Button>
                      </>
                    ) : (
                      <Button variant="danger" className="min-h-9 px-3 text-xs" onClick={() => setConfirmDelete(e.id)} aria-label={`Delete ${e.title}`}>Delete</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Upcoming">
          {next.length === 0 ? (
            <p className="text-sm text-nx-muted">No upcoming events.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {sortEvents(next).map((e) => (
                <li key={e.id}>
                  <button type="button" className="text-left hover:text-nx-pink" onClick={() => setCursor(new Date(`${e.date}T00:00:00`))}>
                    <span className="text-nx-muted">{e.date} · {timeLabel(e, settings.timeFormat)}</span> {e.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
