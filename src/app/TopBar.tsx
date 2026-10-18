import { HandIcon, SettingsIcon } from '../design/icons';
import { Badge } from '../design/ui';
import { formatDate, formatTime, useNow } from '../lib/time';
import type { Route } from '../lib/useHashRoute';
import { useSettings } from '../storage/settings';

export function gestureStatus(s: { gestureEnabled: boolean; setupComplete: boolean }): {
  label: string;
  tone: 'muted' | 'warn' | 'ok';
} {
  if (!s.setupComplete) return { label: 'Gestures: setup needed', tone: 'warn' };
  if (!s.gestureEnabled) return { label: 'Gestures: off', tone: 'muted' };
  return { label: 'Gestures: ready', tone: 'ok' };
}

export function TopBar({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const settings = useSettings();
  const now = useNow(1000);
  const status = gestureStatus(settings);

  return (
    <header className="sticky top-0 z-20 border-b border-nx-line bg-nx-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-2xl font-bold tracking-[0.3em] text-nx-pink">NEXUS</span>
          <span className="hidden text-xs text-nx-muted lg:inline">Your World. Your Gestures. Your Control.</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right leading-tight" aria-label="Current local time and date">
            <div className="font-display text-xl font-semibold tabular-nums" data-testid="clock">
              {formatTime(now, settings.timeFormat)}
            </div>
            <div className="text-xs text-nx-muted">{formatDate(now)}</div>
          </div>

          <span className="hidden items-center gap-1.5 sm:flex" role="status" data-testid="gesture-status">
            <HandIcon />
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>

          <button
            type="button"
            aria-label="Open settings"
            onClick={() => onNavigate('settings')}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-nx-line text-nx-muted hover:border-nx-pink hover:text-nx-pink"
          >
            <SettingsIcon />
          </button>
        </div>
      </div>
    </header>
  );
}
