import { useCallback, useEffect, useRef, useState } from 'react';
import { HandView } from '../design/HandView';
import { ProgressBar } from '../design/ui';
import { ACTIONS, getGesture } from '../gestures/definitions';
import { useEngine } from '../gestures/engine';
import { useSettings } from '../storage/settings';

const POS_KEY = 'nexus.handcam.pos.v1';
const DRAG_THRESHOLD_PX = 8;

interface Pos {
  x: number;
  y: number;
}

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Pos>;
    return typeof p.x === 'number' && typeof p.y === 'number' ? { x: p.x, y: p.y } : null;
  } catch {
    return null;
  }
}

function savePos(p: Pos | null): void {
  try {
    if (p) localStorage.setItem(POS_KEY, JSON.stringify(p));
    else localStorage.removeItem(POS_KEY);
  } catch {
    /* storage unavailable: the window simply starts at the default place next time */
  }
}

/**
 * Small "video call" style window: your camera with the hand skeleton drawn on it, plus what NEXUS
 * currently sees. Drag it anywhere with a finger or the mouse (the spot is remembered), tap it to make
 * it bigger or smaller, double-tap the title strip to send it back to the top right.
 * It can be hidden in Settings.
 */
export function HandCam({ hidden }: { hidden?: boolean }) {
  const cam = useEngine();
  const settings = useSettings();
  const [big, setBig] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pos, setPos] = useState<Pos | null>(loadPos);
  const [dragging, setDragging] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);

  const lastAction = cam.lastAction;
  useEffect(() => {
    if (!lastAction) return;
    setToast(ACTIONS.find((a) => a.id === lastAction.id)?.label ?? lastAction.id);
    const id = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(id);
  }, [lastAction]);

  const clamp = useCallback((p: Pos): Pos => {
    const el = boxRef.current;
    const w = el?.offsetWidth ?? 112;
    const h = el?.offsetHeight ?? 120;
    return {
      x: Math.min(Math.max(4, p.x), Math.max(4, window.innerWidth - w - 4)),
      y: Math.min(Math.max(4, p.y), Math.max(4, window.innerHeight - h - 4)),
    };
  }, []);

  // Keep it on screen when the window is resized, the phone rotates, or the box changes size.
  useEffect(() => {
    const keep = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener('resize', keep);
    return () => window.removeEventListener('resize', keep);
  }, [clamp]);
  useEffect(() => {
    setPos((p) => (p ? clamp(p) : p));
  }, [big, clamp]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    drag.current = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
    box.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_THRESHOLD_PX) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
    }
    setPos(clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (d.moved) {
      setPos((p) => {
        savePos(p);
        return p;
      });
    } else if (!cancelled) {
      setBig((b) => !b); // a plain tap
    }
  };

  const resetPos = () => {
    setPos(null);
    savePos(null);
  };

  const active = cam.status === 'running' || cam.status === 'paused';
  if (!active || hidden || !settings.showHandCam) return null;

  const label = !cam.handDetected
    ? 'No hand'
    : cam.pose === 'none'
      ? 'Hand seen'
      : getGesture(cam.pose).label;

  const placement = pos ? { left: pos.x, top: pos.y } : { right: 12, top: 112 };

  return (
    <div
      ref={boxRef}
      style={{ ...placement, touchAction: 'none' }}
      className={`nx-glass fixed z-30 select-none p-1 ${dragging ? '' : 'transition-[width] duration-300'} ${big ? 'w-52' : 'w-28'} ${dragging ? 'cursor-grabbing shadow-[0_0_24px_rgba(255,45,149,0.55)]' : 'cursor-grab'}`}
      data-testid="hand-cam"
      role="group"
      aria-label="Hand camera. Drag to move, tap to resize."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e)}
      onPointerCancel={(e) => endDrag(e, true)}
    >
      <div className="mb-1 flex items-center justify-center" onDoubleClick={resetPos} title="Double-tap to return to the corner">
        <span className="h-1 w-8 rounded-full bg-nx-line" aria-hidden="true" />
      </div>
      <div className="block w-full rounded-lg">
        <HandView />
      </div>
      <div className="mt-1 px-1 pb-0.5 text-[11px] leading-tight">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate font-medium">{label}</span>
          {cam.handDetected && cam.pose !== 'none' && (
            <span className="text-nx-muted">{Math.round(cam.confidence * 100)}%</span>
          )}
        </div>
        <div className="text-[10px] text-nx-muted" data-testid="hand-cam-fps">
          {cam.fps > 0 ? `${cam.fps} fps` : '… fps'}
          {cam.delegate ? ` · ${cam.delegate}` : ''}
          {cam.fps > 0 && cam.fps < 12 ? ' · slow' : ''}
        </div>
        <ProgressBar value={cam.handDetected ? cam.holdProgress : 0} label="Hold progress" />
        <div className="mt-1 min-h-3 truncate text-nx-pink" aria-live="polite">
          {cam.status === 'paused' ? 'Paused' : toast ? `✓ ${toast}` : ''}
        </div>
      </div>
      {/* Keyboard users: resize without a pointer. */}
      <button type="button" className="sr-only" onClick={() => setBig((b) => !b)} aria-pressed={big}>
        {big ? 'Make hand camera smaller' : 'Make hand camera bigger'}
      </button>
    </div>
  );
}
