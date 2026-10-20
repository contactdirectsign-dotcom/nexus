import { Badge, Button, EmptyState, Panel } from '../../design/ui';
import { deviceTimeZone } from '../../lib/time';
import type { Route } from '../../lib/useHashRoute';
import { useSettings } from '../../storage/settings';
import { gestureStatus } from '../../app/TopBar';
import { useEngine } from '../../gestures/engine';

/** Decorative wireframe globe. It is only an illustration; the real 3D Earth arrives in Phase 3. */
function GlobeArt() {
  return (
    <svg viewBox="0 0 200 200" className="h-40 w-40 shrink-0 text-nx-pink" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
      <circle cx="100" cy="100" r="86" opacity="0.9" />
      <ellipse cx="100" cy="100" rx="86" ry="30" opacity="0.5" />
      <ellipse cx="100" cy="100" rx="86" ry="62" opacity="0.35" />
      <ellipse cx="100" cy="100" rx="30" ry="86" opacity="0.5" />
      <ellipse cx="100" cy="100" rx="62" ry="86" opacity="0.35" />
      <line x1="14" y1="100" x2="186" y2="100" opacity="0.6" />
      <line x1="100" y1="14" x2="100" y2="186" opacity="0.6" />
    </svg>
  );
}

export function Dashboard({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const settings = useSettings();
  const cam = useEngine();
  const status = gestureStatus(settings, cam.status);
  const cameraOn = cam.status === 'running' || cam.status === 'paused';

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel
        title="World"
        glow
        className="lg:col-span-2"
        action={<Badge tone="ok">Phase 3</Badge>}
      >
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <GlobeArt />
          <div className="flex flex-col items-start gap-3">
            <p className="font-display text-2xl font-semibold">Explore the planet</p>
            <p className="text-sm text-nx-muted">
              A 3D Earth with real country shapes, city search with local time and weather, world clocks, a calendar,
              a timer and a stopwatch. The picture here is only an illustration; open World for the real globe.
            </p>
            <Button variant="primary" onClick={() => onNavigate('world')}>
              Open World
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Status">
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-nx-muted">Gestures</dt>
            <dd>
              <Badge tone={status.tone}>{status.label.replace('Gestures: ', '')}</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-nx-muted">Camera</dt>
            <dd>
              <Badge tone={cameraOn ? 'pink' : 'muted'}>{cameraOn ? 'In use' : 'Not in use'}</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-nx-muted">Time zone</dt>
            <dd className="text-right">{deviceTimeZone()}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-nx-muted">
          NEXUS never records or uploads camera video. The camera turns on only when you start it.
        </p>
        {!settings.setupComplete && (
          <Button variant="primary" className="mt-3 w-full" onClick={() => onNavigate('setup')}>
            Set up gestures
          </Button>
        )}
      </Panel>

      <Panel
        title="Today's important news"
        className="lg:col-span-3"
        action={<Badge>Not connected</Badge>}
      >
        <EmptyState
          title="No news source connected yet"
          action={
            <Button onClick={() => onNavigate('pulse')}>Open Pulse</Button>
          }
        >
          Pulse (Phase 4) will show real headlines from free RSS feeds with the source and time on every card.
          Nothing is shown here until a real source is connected, so you never see made-up news.
        </EmptyState>
      </Panel>
    </div>
  );
}
