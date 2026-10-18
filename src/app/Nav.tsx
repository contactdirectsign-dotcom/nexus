import type { Route } from '../lib/useHashRoute';
import { NAV_ITEMS } from './navigation';

interface Props {
  route: Route;
  onNavigate: (r: Route) => void;
}

function itemClass(active: boolean): string {
  return active ? 'text-nx-pink' : 'text-nx-muted hover:text-nx-text';
}

/** Left sidebar on tablets and desktops. */
export function SideNav({ route, onNavigate }: Props) {
  return (
    <nav aria-label="Main" className="hidden w-52 shrink-0 md:block">
      <ul className="sticky top-24 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.route}>
            <button
              type="button"
              onClick={() => onNavigate(item.route)}
              aria-current={route === item.route ? 'page' : undefined}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 font-display text-base font-semibold tracking-wide ${
                route === item.route ? 'nx-glass nx-glow' : 'border border-transparent'
              } ${itemClass(route === item.route)}`}
            >
              {item.icon}
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Bottom tab bar on phones. */
export function BottomNav({ route, onNavigate }: Props) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-nx-line bg-nx-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => (
          <li key={item.route}>
            <button
              type="button"
              onClick={() => onNavigate(item.route)}
              aria-current={route === item.route ? 'page' : undefined}
              className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] ${itemClass(
                route === item.route,
              )}`}
            >
              {item.icon}
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
