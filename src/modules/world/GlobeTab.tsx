import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, EmptyState, Panel } from '../../design/ui';
import { registerActionHandler } from '../../gestures/actionRegistry';
import { useFavorites } from '../../storage/favorites';
import { useSettings } from '../../storage/settings';
import { countryAt, countryList, loadCountries, type CountryFeature } from './geo/countries';
import type { GlobeController, GlobeMarker } from './geo/GlobeCanvas';
import { PlaceInfoPanel, type Selection } from './PlaceInfoPanel';
import { PlaceSearch } from './PlaceSearch';
import type { PlaceResult } from './placeApi';

const GlobeCanvas = lazy(() => import('./geo/GlobeCanvas').then((m) => ({ default: m.GlobeCanvas })));

/** True when the browser can create WebGL contexts at all. (Test environments cannot, and see the list instead.) */
export function webglSupported(): boolean {
  return typeof window !== 'undefined' && 'WebGLRenderingContext' in window;
}

function CountryPicker({ countries, onPick }: { countries: readonly CountryFeature[]; onPick: (name: string, lat: number, lon: number) => void }) {
  const [filter, setFilter] = useState('');
  const list = useMemo(() => countryList(countries), [countries]);
  const shown = list.filter((c) => c.name.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <div>
      <label className="sr-only" htmlFor="country-filter">
        Filter countries
      </label>
      <input
        id="country-filter"
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter countries…"
        className="min-h-11 w-full rounded-xl border border-nx-line bg-nx-surface px-3 text-sm text-nx-text placeholder:text-nx-muted"
      />
      <ul className="mt-2 grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2" aria-label="Countries">
        {shown.map((c) => (
          <li key={c.name}>
            <button
              type="button"
              onClick={() => onPick(c.name, c.lat, c.lon)}
              className="min-h-11 w-full rounded-lg border border-transparent px-3 text-left text-sm hover:border-nx-pink hover:text-nx-pink"
            >
              {c.name}
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-1 text-sm text-nx-muted">No country matches.</li>}
      </ul>
    </div>
  );
}

export function GlobeTab() {
  const settings = useSettings();
  const favorites = useFavorites();
  const [countries, setCountries] = useState<CountryFeature[] | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [supported, setSupported] = useState(webglSupported);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const controller = useRef<GlobeController | null>(null);

  useEffect(() => {
    let live = true;
    loadCountries()
      .then((c) => live && setCountries(c))
      .catch(() => live && setMapError('The country map data could not be loaded.'));
    return () => {
      live = false;
    };
  }, []);

  const select = useCallback((sel: Selection, country: string | null, fly: boolean) => {
    setSelection(sel);
    setHighlight(country);
    if (fly) controller.current?.flyTo(sel.lat, sel.lon);
  }, []);

  const onPick = useCallback(
    (lat: number, lon: number) => {
      const country = countries ? countryAt(countries, lat, lon) : null;
      select(
        {
          id: `pt:${lat.toFixed(1)},${lon.toFixed(1)}`,
          name: country ?? 'Selected point',
          country: country ?? undefined,
          lat,
          lon,
        },
        country,
        false,
      );
    },
    [countries, select],
  );

  const onSearchSelect = useCallback(
    (p: PlaceResult) => {
      const country = countries ? countryAt(countries, p.lat, p.lon) : null;
      select(
        { id: p.id, name: p.name, country: p.country, lat: p.lat, lon: p.lon, timezone: p.timezone },
        country,
        true,
      );
    },
    [countries, select],
  );

  const markers = useMemo<GlobeMarker[]>(() => {
    const list: GlobeMarker[] = favorites.map((f) => ({ id: f.id, lat: f.lat, lon: f.lon }));
    if (selection) list.push({ id: 'selected', lat: selection.lat, lon: selection.lon, selected: true });
    return list;
  }, [favorites, selection]);

  // Gesture actions while this tab is open (they take priority over the app-wide defaults).
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  useEffect(() => {
    if (!supported) return undefined;
    const ctl = () => controller.current;
    const turn = (dLon: number, dLat: number) => () => {
      const c = ctl();
      if (!c) return false;
      c.rotateBy(dLon, dLat);
      return true;
    };
    const offs = [
      registerActionHandler('next-panel', turn(30, 0)),
      registerActionHandler('previous-panel', turn(-30, 0)),
      registerActionHandler('scroll-up', turn(0, 20)),
      registerActionHandler('scroll-down', turn(0, -20)),
      registerActionHandler('zoom', () => {
        const c = ctl();
        if (!c) return false;
        const at = c.center();
        c.flyTo(at.lat, at.lon, c.distance() > 1.7 ? c.distance() * 0.6 : 3);
        return true;
      }),
      registerActionHandler('select', () => {
        const c = ctl();
        if (!c) return false;
        const at = c.center();
        onPickRef.current(at.lat, at.lon);
        return true;
      }),
      registerActionHandler('back', () => {
        const c = ctl();
        if (!c) return false;
        if (selectionRef.current) {
          setSelection(null);
          setHighlight(null);
          return true;
        }
        if (c.distance() < 2.9) {
          c.reset();
          return true;
        }
        return false; // nothing to undo here: let "back" do its normal job
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [supported]);

  const showGlobe = supported && countries !== null;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Panel title="Earth" action={<Badge tone={showGlobe ? 'ok' : 'muted'}>{showGlobe ? '3D' : supported ? 'Loading' : 'List mode'}</Badge>}>
          {mapError && <EmptyState title="Map data unavailable">{mapError} Place search still works.</EmptyState>}
          {!mapError && !supported && (
            <EmptyState title="3D Earth is not available here">
              This browser or device cannot show WebGL graphics (or they are switched off). You can still search for a
              place, or choose a country from the list below.
            </EmptyState>
          )}
          {!mapError && supported && countries === null && <p className="py-10 text-center text-sm text-nx-muted">Loading the world map…</p>}
          {showGlobe && countries && (
            <>
              <div className="h-[min(65vh,30rem)] w-full overflow-hidden rounded-xl border border-nx-line bg-black" data-testid="globe">
                <Suspense fallback={<p className="p-6 text-center text-sm text-nx-muted">Loading 3D Earth…</p>}>
                  <GlobeCanvas
                    countries={countries}
                    highlight={highlight}
                    markers={markers}
                    reducedMotion={settings.reducedEffects}
                    onPick={onPick}
                    onController={(c) => {
                      controller.current = c;
                    }}
                    onUnsupported={() => setSupported(false)}
                  />
                </Suspense>
              </div>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Globe controls">
                <Button aria-label="Turn west" onClick={() => controller.current?.rotateBy(-20, 0)}>←</Button>
                <Button aria-label="Turn east" onClick={() => controller.current?.rotateBy(20, 0)}>→</Button>
                <Button aria-label="Tilt north" onClick={() => controller.current?.rotateBy(0, 15)}>↑</Button>
                <Button aria-label="Tilt south" onClick={() => controller.current?.rotateBy(0, -15)}>↓</Button>
                <Button aria-label="Zoom in" onClick={() => controller.current?.zoomBy(1.3)}>+</Button>
                <Button aria-label="Zoom out" onClick={() => controller.current?.zoomBy(1 / 1.3)}>−</Button>
                <Button onClick={() => controller.current?.reset()}>Reset view</Button>
              </div>
              <p className="mt-3 text-xs text-nx-muted">
                Drag to turn, pinch or scroll to zoom, tap a place to select it. With gestures on, the actions
                Next/Previous panel turn the globe, Scroll tilts it, Zoom zooms in or out, Select picks the centre and
                Back clears the selection.
              </p>
            </>
          )}
        </Panel>
      </div>

      <div className="flex flex-col gap-4 lg:col-span-2">
        <Panel title="Find a place">
          <PlaceSearch onSelect={onSearchSelect} actionLabel="Show" />
        </Panel>
        {selection ? (
          <PlaceInfoPanel selection={selection} onCenter={() => controller.current?.flyTo(selection.lat, selection.lon)} />
        ) : (
          <Panel title="Selected place">
            <EmptyState title="Nothing selected">
              {showGlobe ? 'Tap a country on the globe or search for a city.' : 'Search for a city or choose a country below.'}
            </EmptyState>
          </Panel>
        )}
        {countries && (
          <details className="nx-glass p-4" open={!supported}>
            <summary className="cursor-pointer font-display text-sm font-semibold uppercase tracking-[0.18em] text-nx-muted">
              Browse countries
            </summary>
            <div className="mt-3">
              <CountryPicker
                countries={countries}
                onPick={(name, lat, lon) =>
                  select({ id: `country:${name}`, name, country: name, lat, lon }, name, true)
                }
              />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
