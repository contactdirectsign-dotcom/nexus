import { useEffect, useState } from 'react';
import { ACTIONS, getGesture } from '../gestures/definitions';
import { useEngine } from '../gestures/engine';
import { ProgressBar } from '../design/ui';

/** Small on-screen readout of what the camera currently sees, plus a brief "action done" toast. */
export function GestureHud({ hidden }: { hidden?: boolean }) {
  const cam = useEngine();
  const [toast, setToast] = useState<string | null>(null);

  const lastAction = cam.lastAction;
  useEffect(() => {
    if (!lastAction) return;
    const label = ACTIONS.find((a) => a.id === lastAction.id)?.label ?? lastAction.id;
    setToast(label);
    const id = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(id);
  }, [lastAction]);

  const active = cam.status === 'running' || cam.status === 'paused';
  if (!active || hidden) return null;

  const poseLabel = !cam.handDetected
    ? 'No hand in view'
    : cam.pose === 'none'
      ? 'Hand seen, no gesture'
      : getGesture(cam.pose).label;

  return (
    <div
      className="nx-glass fixed bottom-[4.75rem] right-3 z-30 w-52 p-3 text-xs md:bottom-4"
      data-testid="gesture-hud"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-display text-sm font-semibold">{poseLabel}</span>
        {cam.handDetected && cam.pose !== 'none' && (
          <span className="text-nx-muted">{Math.round(cam.confidence * 100)}%</span>
        )}
      </div>
      <ProgressBar value={cam.handDetected ? cam.holdProgress : 0} label="Hold progress" />
      <div className="mt-2 min-h-4 text-nx-pink" aria-live="polite">
        {cam.status === 'paused' ? 'Paused' : toast ? `✓ ${toast}` : ''}
      </div>
    </div>
  );
}
