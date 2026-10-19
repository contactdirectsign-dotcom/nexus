import { useEffect, useState } from 'react';
import { HandView } from '../design/HandView';
import { ProgressBar } from '../design/ui';
import { ACTIONS, getGesture } from '../gestures/definitions';
import { useEngine } from '../gestures/engine';
import { useSettings } from '../storage/settings';

/**
 * Small "video call" style window in the top right: your camera with the hand skeleton drawn on it,
 * plus what NEXUS currently sees. Tap it to make it bigger or smaller. It can be hidden in Settings.
 */
export function HandCam({ hidden }: { hidden?: boolean }) {
  const cam = useEngine();
  const settings = useSettings();
  const [big, setBig] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const lastAction = cam.lastAction;
  useEffect(() => {
    if (!lastAction) return;
    setToast(ACTIONS.find((a) => a.id === lastAction.id)?.label ?? lastAction.id);
    const id = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(id);
  }, [lastAction]);

  const active = cam.status === 'running' || cam.status === 'paused';
  if (!active || hidden || !settings.showHandCam) return null;

  const label = !cam.handDetected
    ? 'No hand'
    : cam.pose === 'none'
      ? 'Hand seen'
      : getGesture(cam.pose).label;

  return (
    <div
      className={`nx-glass fixed right-3 top-28 z-30 p-1 transition-[width] duration-300 ${big ? 'w-52' : 'w-28'}`}
      data-testid="hand-cam"
    >
      <button
        type="button"
        onClick={() => setBig((b) => !b)}
        aria-pressed={big}
        aria-label={big ? 'Make hand camera smaller' : 'Make hand camera bigger'}
        className="block w-full rounded-lg"
      >
        <HandView />
      </button>
      <div className="mt-1 px-1 pb-0.5 text-[11px] leading-tight">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate font-medium">{label}</span>
          {cam.handDetected && cam.pose !== 'none' && (
            <span className="text-nx-muted">{Math.round(cam.confidence * 100)}%</span>
          )}
        </div>
        <ProgressBar value={cam.handDetected ? cam.holdProgress : 0} label="Hold progress" />
        <div className="mt-1 min-h-3 truncate text-nx-pink" aria-live="polite">
          {cam.status === 'paused' ? 'Paused' : toast ? `✓ ${toast}` : ''}
        </div>
      </div>
    </div>
  );
}
