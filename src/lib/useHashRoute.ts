import { useCallback, useEffect, useState } from 'react';

export const ROUTES = ['dashboard', 'world', 'pulse', 'settings', 'setup'] as const;
export type Route = (typeof ROUTES)[number];

export function parseRoute(hash: string): Route {
  const name = hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'dashboard';
}

/** Tiny hash router. Hash URLs work on GitHub Pages without any server configuration. */
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((r: Route) => {
    window.location.hash = `#/${r}`;
  }, []);

  return [route, navigate];
}

/** Go to a page from anywhere (also usable outside React). */
export function go(route: Route): void {
  window.location.hash = `#/${route}`;
}
