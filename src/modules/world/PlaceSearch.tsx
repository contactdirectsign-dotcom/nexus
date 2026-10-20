import { useEffect, useId, useState } from 'react';
import { searchPlaces, type PlaceResult } from './placeApi';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; items: PlaceResult[] }
  | { kind: 'error'; message: string };

export function placeLabel(p: PlaceResult): string {
  return [p.name, p.admin && p.admin !== p.name ? p.admin : undefined, p.country].filter(Boolean).join(', ');
}

/** City search (Open-Meteo geocoding). Searches as you type, after a short pause. */
export function PlaceSearch({
  onSelect,
  actionLabel = 'Select',
  placeholder = 'Search a city or place…',
}: {
  onSelect: (p: PlaceResult) => void;
  actionLabel?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const inputId = useId();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setState({ kind: 'idle' });
      return;
    }
    const ctrl = new AbortController();
    setState({ kind: 'loading' });
    const id = window.setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((items) => setState({ kind: 'results', items }))
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return;
          setState({
            kind: 'error',
            message:
              err instanceof TypeError
                ? 'Could not reach the place search. Check your internet connection and try again.'
                : err instanceof Error
                  ? err.message
                  : 'Place search failed.',
          });
        });
    }, 350);
    return () => {
      window.clearTimeout(id);
      ctrl.abort();
    };
  }, [query]);

  return (
    <div>
      <label htmlFor={inputId} className="sr-only">
        Search a city or place
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="min-h-11 w-full rounded-xl border border-nx-line bg-nx-surface px-3 text-sm text-nx-text placeholder:text-nx-muted"
      />
      <div aria-live="polite" className="mt-2 text-sm">
        {state.kind === 'loading' && <p className="text-nx-muted">Searching…</p>}
        {state.kind === 'error' && <p className="text-red-300">{state.message}</p>}
        {state.kind === 'results' && state.items.length === 0 && (
          <p className="text-nx-muted">No places found for “{query.trim()}”.</p>
        )}
        {state.kind === 'results' && state.items.length > 0 && (
          <ul className="divide-y divide-nx-line/60 overflow-hidden rounded-xl border border-nx-line">
            {state.items.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-nx-raised"
                  aria-label={`${actionLabel}: ${placeLabel(p)}`}
                >
                  <span>{placeLabel(p)}</span>
                  <span className="shrink-0 text-xs text-nx-pink">{actionLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
