import { Badge, Button, EmptyState, Panel } from '../../design/ui';
import { deviceTimeZone, formatDate, formatTime, useNow } from '../../lib/time';
import { describeDifference, isDaytimeAt, utcOffsetMinutes } from '../../lib/timezones';
import { addFavorite, MAX_FAVORITES, removeFavorite, useFavorites } from '../../storage/favorites';
import { useSettings } from '../../storage/settings';
import { useState } from 'react';
import { PlaceSearch } from './PlaceSearch';
import type { PlaceResult } from './placeApi';

export function ClockTab() {
  const now = useNow(1000);
  const settings = useSettings();
  const favorites = useFavorites();
  const [note, setNote] = useState<string | null>(null);
  const device = deviceTimeZone();
  const deviceOffset = utcOffsetMinutes(device, now);

  const add = (p: PlaceResult) => {
    if (!p.timezone) {
      setNote(`No time zone is known for ${p.name}, so it cannot be added.`);
      return;
    }
    const ok = addFavorite({ id: p.id, name: p.name, country: p.country, lat: p.lat, lon: p.lon, timezone: p.timezone });
    setNote(ok ? `${p.name} added.` : `The list is full (${MAX_FAVORITES} cities). Remove one first.`);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Panel title="Your time" glow>
          <div className="font-display text-4xl font-semibold tabular-nums">{formatTime(now, settings.timeFormat)}</div>
          <div className="text-sm text-nx-muted">
            {formatDate(now)} · {device}
          </div>
        </Panel>
        <Panel title="Saved cities" action={<Badge>{favorites.length}/{MAX_FAVORITES}</Badge>}>
          {favorites.length === 0 ? (
            <EmptyState title="No saved cities yet">Search for a city on the right and add it. Time zones and daylight saving are handled by your browser's built-in time-zone data.</EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {favorites.map((f) => {
                const offset = utcOffsetMinutes(f.timezone, now);
                return (
                  <li key={f.id} className="rounded-xl border border-nx-line bg-nx-surface/60 p-3" data-testid="clock-card">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{f.name}</div>
                        <div className="text-xs text-nx-muted">{f.country ?? f.timezone}</div>
                      </div>
                      <span aria-label={isDaytimeAt(f.timezone, now) ? 'Daytime' : 'Night'} title={isDaytimeAt(f.timezone, now) ? 'Daytime' : 'Night'}>
                        {isDaytimeAt(f.timezone, now) ? '☀' : '☾'}
                      </span>
                    </div>
                    <div className="mt-2 font-display text-3xl font-semibold tabular-nums">
                      {formatTime(now, settings.timeFormat, f.timezone)}
                    </div>
                    <div className="text-xs text-nx-muted">
                      {formatDate(now, f.timezone)} · {describeDifference(offset, deviceOffset)}
                    </div>
                    <Button className="mt-2 min-h-9 px-3 text-xs" onClick={() => removeFavorite(f.id)} aria-label={`Remove ${f.name}`}>
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="Add a city">
        <PlaceSearch onSelect={add} actionLabel="Add" />
        {note && (
          <p className="mt-2 text-sm text-nx-pink" role="status">
            {note}
          </p>
        )}
        <p className="mt-4 text-xs text-nx-muted">
          City search by{' '}
          <a className="underline hover:text-nx-pink" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo.com
          </a>
          .
        </p>
      </Panel>
    </div>
  );
}
