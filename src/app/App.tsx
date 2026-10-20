import { lazy, Suspense, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ROUTES, useHashRoute, type Route } from '../lib/useHashRoute';
import { useSettings } from '../storage/settings';
import { ErrorBoundary } from './ErrorBoundary';
import { BottomNav, SideNav } from './Nav';
import { TopBar } from './TopBar';
import { AirCursor } from './AirCursor';
import { HandCam } from './HandCam';
import { useGestureControl } from './useGestureControl';
import { Dashboard } from '../modules/dashboard/Dashboard';

// Less-used modules load only when opened, which keeps the first load small on phones.
const World = lazy(() => import('../modules/world/World').then((m) => ({ default: m.World })));
const Pulse = lazy(() => import('../modules/pulse/Pulse').then((m) => ({ default: m.Pulse })));
const Lab = lazy(() => import('../modules/lab/Lab').then((m) => ({ default: m.Lab })));
const SetupWizard = lazy(() => import('../modules/setup/SetupWizard').then((m) => ({ default: m.SetupWizard })));
const Settings = lazy(() => import('../modules/settings/Settings').then((m) => ({ default: m.Settings })));

const TITLES: Record<Route, string> = {
  dashboard: 'Dashboard',
  world: 'World',
  pulse: 'Pulse',
  lab: 'Gesture Lab',
  settings: 'Settings',
  setup: 'Gesture setup',
};

function View({ route, navigate }: { route: Route; navigate: (r: Route) => void }) {
  switch (route) {
    case 'world':
      return <World />;
    case 'pulse':
      return <Pulse />;
    case 'lab':
      return <Lab />;
    case 'settings':
      return <Settings />;
    case 'setup':
      return <SetupWizard />;
    default:
      return <Dashboard onNavigate={navigate} />;
  }
}

export function App() {
  const [route, navigate] = useHashRoute();
  const settings = useSettings();
  useGestureControl(route, navigate);

  // Keep <html data-reduced> and the page title in sync with state.
  useEffect(() => {
    document.documentElement.dataset.reduced = String(settings.reducedEffects);
  }, [settings.reducedEffects]);
  useEffect(() => {
    document.title = `${TITLES[route]} · NEXUS`;
  }, [route]);

  // Safety: ROUTES is the single source of truth for valid pages.
  const safeRoute: Route = (ROUTES as readonly string[]).includes(route) ? route : 'dashboard';

  return (
    <div className="flex min-h-full flex-col">
      <TopBar onNavigate={navigate} />
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-5 pb-24 md:pb-8">
        <SideNav route={safeRoute} onNavigate={navigate} />
        <main className="min-w-0 flex-1" id="main">
          <h1 className="sr-only">{TITLES[safeRoute]}</h1>
          <ErrorBoundary resetKey={safeRoute}>
            <Suspense fallback={<p className="text-sm text-nx-muted" role="status">Loading…</p>}>
              <motion.div
                key={safeRoute}
                initial={settings.reducedEffects ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: settings.reducedEffects ? 0 : 0.4, ease: 'easeOut' }}
              >
                <View route={safeRoute} navigate={navigate} />
              </motion.div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <HandCam hidden={safeRoute === 'setup'} />
      <AirCursor />
      <BottomNav route={safeRoute} onNavigate={navigate} />
    </div>
  );
}
