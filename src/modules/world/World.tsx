import { Badge, EmptyState, Panel } from '../../design/ui';

const PLANNED = [
  'Interactive 3D Earth with rotation, zoom and location selection',
  'City search and a country/location information panel',
  'World clock with saved cities (correct time zones and daylight saving)',
  'Calendar with month, week and day views',
  'Timer and stopwatch',
];

export function World() {
  return (
    <Panel title="World" action={<Badge tone="warn">Phase 3</Badge>}>
      <EmptyState title="World is not built yet">
        This section is planned for Phase 3. Phase 1 only provides the app foundation.
      </EmptyState>
      <h3 className="mb-2 mt-5 font-display text-sm font-semibold uppercase tracking-[0.18em] text-nx-muted">
        Planned
      </h3>
      <ul className="list-inside list-disc space-y-1 text-sm text-nx-muted">
        {PLANNED.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-nx-muted">
        Note: browsers cannot reliably ring alarms when the app is closed, so only an in-app timer and stopwatch
        are planned for the web version. Reliable background alarms would need a native Android app later.
      </p>
    </Panel>
  );
}
