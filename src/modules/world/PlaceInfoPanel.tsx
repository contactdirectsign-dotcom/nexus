import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Panel } from '../../design/ui';
import { formatCoords } from '../../lib/geoMath';
import { setNewsPlace } from '../../lib/newsContext';
import { deviceTimeZone, formatDate, formatTime, useNow } from '../../lib/time';
import { describeDifference, formatOffset, isValidTimeZone, utcOffsetMinutes } from '../../lib/timezones';
import { go } from '../../lib/useHashRoute';
import { addFavorite, useFavorites } from '../../storage/favorites';
import { useSettings } from '../../storage/settings';
import { fetchPlaceInfo, type PlaceInfo } from './placeApi';

/** What is currently selected on the globe or from search. */
export interface Selection {
  /** Stable id (used for saving). */
  id: string;
  name: string;
  country?: string;
  lat: number;
  lon: number;
  /** Known IANA zone (from search results). Otherwise it is looked up. */
  timezone?: string;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ok'; info: PlaceInfo }
  | { kind: 'error'; message: string };

export function PlaceInfoPanel({ selection, onCenter }: { selection: Selection; onCenter: () => void }) {
  const settings = useSettings();
  const favorites = useFavorites();
  const now = useNow(1000);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState<string | null>(null);

  const { lat, lon } = selection;
  useEffect(() => {
    const ctrl = new AbortController();
    setLoad({ kind: 'loading' });
    fetchPlaceInfo(lat, lon, ctrl.signal)
      .then((info) => setLoad({ kind: 'ok', info }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setLoad({
          kind: 'error',
          message:
            err instanceof TypeError
              ? 'Could not reach the weather and time service. You may be offline.'
              : err instanceof Error
                ? err.message
                : 'Could not load details for this place.',
        });
      });
    return () => ctrl.abort();
  }, [lat, lon, attempt]);

  useEffect(() => setNote(null), [selection.id]);

  const info = load.kind === 'ok' ? load.info : null;
  const zone = [info?.timezone, selection.timezone].find((z): z is string => !!z && isValidTimeZone(z));
  const saved = favorites.some((f) => f.id === selection.id);
  const deviceZone = deviceTimeZone();

  const save = useCallback(() => {
    if (!zone) return;
    const ok = addFavorite({
      id: selection.id,
      name: selection.name,
      country: selection.country,
      lat: selection.lat,
      lon: selection.lon,
      timezone: zone,
    });
    setNote(ok ? 'Saved to your world clock.' : 'Your world clock is full (12 cities). Remove one first.');
  }, [zone, selection]);

  const title = [selection.name, selection.country && selection.country !== selection.name ? selection.country : undefined]
    .filter(Boolean)
    .join(', ');

  return (
    <Panel title="Selected place" glow action={zone ? <Badge tone="pink">{zone}</Badge> : undefined}>
      <h3 className="font-display text-xl font-semibold" data-testid="place-title">
        {title}
      </h3>
      <p className="text-xs text-nx-muted">{formatCoords(selection.lat, selection.lon)}</p>

      {zone ? (
        <div className="mt-3">
          <div className="font-display text-3xl font-semibold tabular-nums" data-testid="place-time">
            {formatTime(now, settings.timeFormat, zone)}
          </div>
          <div className="text-sm text-nx-muted">
            {formatDate(now, zone)} · {formatOffset(utcOffsetMinutes(zone, now))} ·{' '}
            {describeDifference(utcOffsetMinutes(zone, now), utcOffsetMinutes(deviceZone, now))}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-nx-muted">
          {load.kind === 'loading' ? 'Looking up the local time…' : 'Local time unavailable right now.'}
        </p>
      )}

      {load.kind === 'loading' && <p className="mt-3 text-sm text-nx-muted">Loading weather…</p>}
      {load.kind === 'error' && (
        <div className="mt-3 rounded-xl border border-nx-line p-3 text-sm" role="alert">
          <p className="text-red-300">{load.message}</p>
          <Button className="mt-2" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      )}
      {info && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          {info.weather !== undefined && (
            <div>
              <dt className="text-nx-muted">Weather</dt>
              <dd>{info.weather}</dd>
            </div>
          )}
          {info.temperatureC !== undefined && (
            <div>
              <dt className="text-nx-muted">Temperature</dt>
              <dd>{Math.round(info.temperatureC)}°C</dd>
            </div>
          )}
          {info.windKmh !== undefined && (
            <div>
              <dt className="text-nx-muted">Wind</dt>
              <dd>{Math.round(info.windKmh)} km/h</dd>
            </div>
          )}
          {info.isDay !== undefined && (
            <div>
              <dt className="text-nx-muted">Right now</dt>
              <dd>{info.isDay ? 'Daytime' : 'Night'}</dd>
            </div>
          )}
          <div>
            <dt className="text-nx-muted">Sunrise</dt>
            <dd>{info.sunrise ?? 'No sunrise today'}</dd>
          </div>
          <div>
            <dt className="text-nx-muted">Sunset</dt>
            <dd>{info.sunset ?? 'No sunset today'}</dd>
          </div>
        </dl>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={save} disabled={!zone || saved}>
          {saved ? 'Saved to world clock' : 'Save to world clock'}
        </Button>
        <Button onClick={onCenter}>Show on globe</Button>
        <Button
          onClick={() => {
            setNewsPlace({ name: selection.name, country: selection.country, lat: selection.lat, lon: selection.lon });
            go('pulse');
          }}
        >
          Search news here
        </Button>
      </div>
      {note && (
        <p className="mt-2 text-sm text-nx-pink" role="status">
          {note}
        </p>
      )}
      <p className="mt-4 text-xs text-nx-muted">
        Weather and time zone data by{' '}
        <a className="underline hover:text-nx-pink" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo.com
        </a>{' '}
        (CC BY 4.0). Country shapes: Natural Earth.
      </p>
    </Panel>
  );
}
