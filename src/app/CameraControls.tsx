import type { ReactNode } from 'react';
import { Button } from '../design/ui';
import { engine, useEngine } from '../gestures/engine';
import { updateSettings, useSettings } from '../storage/settings';

/**
 * The always-visible camera indicator. Whenever the camera is on, this strip shows it
 * together with Pause and Stop buttons. It is never hidden while the camera is active.
 */
export function CameraControls() {
  const cam = useEngine();
  const settings = useSettings();

  const wrap = (children: ReactNode, tone = 'border-nx-line') => (
    <div className={`border-t ${tone} bg-nx-surface/60`}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
        {children}
      </div>
    </div>
  );

  if (cam.status === 'running' || cam.status === 'paused') {
    const paused = cam.status === 'paused';
    return wrap(
      <>
        <span className="flex items-center gap-2" role="status">
          <span
            aria-hidden="true"
            className={`h-3 w-3 rounded-full ${paused ? 'bg-nx-warn' : 'animate-pulse bg-red-500'}`}
          />
          {paused ? 'Camera on, gestures paused (checking only for the pause gesture)' : 'Camera on: tracking your hand'}
        </span>
        <span className="flex gap-2">
          <Button className="min-h-9 px-3" onClick={() => engine.setPaused(!paused)}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button
            variant="danger"
            className="min-h-9 px-3"
            onClick={() => {
              engine.stop();
              updateSettings({ gestureEnabled: false });
            }}
          >
            Stop camera
          </Button>
        </span>
      </>,
      'border-red-500/40',
    );
  }

  if (cam.status === 'requesting' || cam.status === 'loading') {
    return wrap(
      <span role="status">
        {cam.status === 'requesting'
          ? 'Waiting for camera permission…'
          : 'Loading hand tracking (downloads once, then works offline-cached)…'}
      </span>,
    );
  }

  if (cam.status === 'error' && cam.error) {
    return wrap(
      <>
        <span role="alert" className="text-nx-warn">
          {cam.error}
        </span>
        <Button className="min-h-9 px-3" onClick={() => void engine.start()}>
          Retry
        </Button>
      </>,
      'border-nx-warn/50',
    );
  }

  if (cam.status === 'suspended') {
    return wrap(<span role="status">Camera released while NEXUS is in the background. It restarts when you return.</span>);
  }

  if (settings.gestureEnabled && settings.setupComplete) {
    return wrap(
      <>
        <span>Gestures are enabled but the camera is off.</span>
        <Button className="min-h-9 px-3" onClick={() => void engine.start()}>
          Start camera
        </Button>
      </>,
    );
  }

  return null;
}
