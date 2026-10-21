import { useSyncExternalStore } from 'react';
import { AirCursorTracker, HIDDEN_CURSOR, type CursorEvent, type CursorMode, type CursorState } from './cursor';
import { engine, type FrameMeta } from './engine';
import type { Landmarks } from './landmarks';

/**
 * Connects the air cursor to the page: turns pinches into real clicks and drags, highlights what is under the
 * cursor, and turns two-finger movement into scrolling (or zooming, where something handles the wheel, like
 * the globe). It sends ordinary pointer/mouse events, so every button, tab and canvas works the same as with
 * a finger or a mouse. Nothing here records or sends anything anywhere.
 */

export interface CursorView extends CursorState {
  /** True while the cursor is over something clickable. */
  hovering: boolean;
}

const POINTER_ID = 4242;
const CLICK_SLOP_PX = 14;
const SCROLL_GAIN = 2.4;
const INTERACTIVE =
  'button, a[href], [role="tab"], [role="button"], input, select, textarea, summary, label, [data-air-target]';

let tracker = new AirCursorTracker();
let running = false;
let offFrames: (() => void) | null = null;
let offStatus: (() => void) | null = null;

let view: CursorView = { ...HIDDEN_CURSOR, hovering: false };
const listeners = new Set<(v: CursorView) => void>();
let hoverEl: Element | null = null;
let press: { target: Element; x: number; y: number; moved: boolean } | null = null;

/** Diagnostics for the optional debug line in the hand window. */
export function getAirDebug(): ReturnType<AirCursorTracker['debug']> {
  return tracker.debug();
}

// Magnetic targets: small buttons are hard to hit with a finger in the air, so a cursor that is just next to a
// clickable thing counts as being on it. The list of targets is cached briefly (measuring everything every
// frame would itself cause lag).
const SNAP_PX = 22;
const CACHE_MS = 300;
let snapCache: { at: number; items: { el: Element; r: DOMRect }[] } = { at: 0, items: [] };

function magnetTarget(px: number, py: number, under: Element | null): Element | null {
  if (under && under.closest(INTERACTIVE)) return under;
  const now = performance.now();
  if (now - snapCache.at > CACHE_MS) {
    const items: { el: Element; r: DOMRect }[] = [];
    document.querySelectorAll(INTERACTIVE).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) items.push({ el, r });
    });
    snapCache = { at: now, items };
  }
  let best: Element | null = null;
  let bestD = SNAP_PX;
  for (const { el, r } of snapCache.items) {
    const dx = Math.max(r.left - px, 0, px - r.right);
    const dy = Math.max(r.top - py, 0, py - r.bottom);
    const d = Math.hypot(dx, dy);
    if (d < bestD && el.isConnected) {
      bestD = d;
      best = el;
    }
  }
  return best ?? under;
}

export function getAirCursor(): CursorView {
  return view;
}

export function subscribeAirCursor(cb: (v: CursorView) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function publish(next: CursorView): void {
  view = next;
  listeners.forEach((l) => l(next));
}

function fire(target: Element, type: string, x: number, y: number, buttons: number): boolean {
  const init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y,
    button: 0,
    buttons,
    view: window,
  };
  const event =
    type.startsWith('pointer') && typeof PointerEvent !== 'undefined'
      ? new PointerEvent(type, { ...init, pointerId: POINTER_ID, pointerType: 'mouse', isPrimary: true })
      : new MouseEvent(type.replace('pointer', 'mouse'), init);
  return target.dispatchEvent(event);
}

function setHover(el: Element | null): void {
  const next = el ? el.closest(INTERACTIVE) : null;
  if (next === hoverEl) return;
  hoverEl?.removeAttribute('data-air-hover');
  next?.setAttribute('data-air-hover', '');
  hoverEl = next;
}

function nearestScrollable(el: Element | null): HTMLElement | null {
  for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return node as HTMLElement;
  }
  return null;
}

/** Sliders ignore synthetic mouse events, so set their value from the cursor position directly. */
function driveRange(input: HTMLInputElement, clientX: number): void {
  const r = input.getBoundingClientRect();
  if (r.width <= 0) return;
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const step = Number(input.step || 1) || 1;
  const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  const value = Math.round((min + frac * (max - min)) / step) * step;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, String(Math.min(max, Math.max(min, value))));
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function vibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

function pressDown(el: Element, x: number, y: number): void {
  press = { target: el, x, y, moved: false };
  fire(el, 'pointerdown', x, y, 1);
  fire(el, 'mousedown', x, y, 1);
  if (el instanceof HTMLInputElement && el.type === 'range') driveRange(el, x);
  else {
    const field = el.closest('input, textarea, select');
    if (field instanceof HTMLElement) field.focus();
  }
  vibrate(10);
}

function pressMove(x: number, y: number): void {
  if (!press) return;
  if (!press.moved && Math.hypot(x - press.x, y - press.y) > CLICK_SLOP_PX) press.moved = true;
  if (!press.target.isConnected) return;
  fire(press.target, 'pointermove', x, y, 1);
  fire(press.target, 'mousemove', x, y, 1);
  if (press.target instanceof HTMLInputElement && press.target.type === 'range') driveRange(press.target, x);
}

function pressUp(x: number, y: number): void {
  const p = press;
  press = null;
  if (!p || !p.target.isConnected) return;
  fire(p.target, 'pointerup', x, y, 0);
  fire(p.target, 'mouseup', x, y, 0);
  if (!p.moved) {
    const clickable = p.target.closest(INTERACTIVE);
    const el = clickable instanceof HTMLElement ? clickable : p.target instanceof HTMLElement ? p.target : null;
    if (el && !(el instanceof HTMLInputElement && el.type === 'range')) el.click();
  }
  vibrate(6);
}

function applyScroll(el: Element | null, x: number, y: number, dyFraction: number): void {
  // Finger moves down -> content moves down (like dragging a page), so the page scrolls up.
  const delta = -dyFraction * window.innerHeight * SCROLL_GAIN;
  if (Math.abs(delta) < 0.5) return;
  if (el) {
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY: delta, deltaMode: 0 });
    if (!el.dispatchEvent(wheel)) return; // something (the globe) used it as zoom
  }
  const scroller = nearestScrollable(el);
  if (scroller) scroller.scrollBy({ top: delta, behavior: 'auto' });
  else window.scrollBy({ top: delta, behavior: 'auto' });
}

function handleEvents(events: CursorEvent[], x: number, y: number, el: Element | null): void {
  for (const e of events) {
    if (e === 'down' && el) pressDown(el, x, y);
    else if (e === 'up') pressUp(x, y);
  }
}

function hide(): void {
  const events = tracker.lost();
  if (events.length) pressUp(view.x * window.innerWidth, view.y * window.innerHeight);
  setHover(null);
  if (view.mode !== 'hidden') publish({ ...HIDDEN_CURSOR, hovering: false });
}

function onFrame(_hands: readonly Landmarks[], _size: { width: number; height: number }, meta: FrameMeta): void {
  const lm = meta.raw;
  // Any detected hand is enough: the cursor decides for itself whether the fingers are in a cursor pose.
  if (!running || engine.getSnapshot().status !== 'running' || !lm) {
    hide();
    return;
  }
  tracker.setConfig({ aspect: meta.aspect });
  const { state, events } = tracker.update(meta.t, lm, meta.pose === 'pointing');
  if (state.mode === 'hidden') {
    hide();
    return;
  }
  const px = state.x * window.innerWidth;
  const py = state.y * window.innerHeight;
  const el = magnetTarget(px, py, document.elementFromPoint(px, py));

  if (state.mode !== 'pressed') setHover(el);
  handleEvents(events, px, py, el);
  if (state.mode === 'pressed') pressMove(px, py);
  if (state.mode === 'scroll') applyScroll(el, px, py, state.scrollDy);

  publish({ ...state, hovering: hoverEl !== null });
}

/** Start the air cursor. Returns a function that stops it. Safe to call more than once. */
export function startAirPointer(): () => void {
  if (running) return stopAirPointer;
  running = true;
  tracker = new AirCursorTracker();
  offFrames = engine.subscribeFrames(onFrame);
  // Leave nothing pressed or highlighted if the camera stops, pauses or the tab hides.
  offStatus = engine.subscribe(() => {
    if (engine.getSnapshot().status !== 'running') hide();
  });
  return stopAirPointer;
}

export function stopAirPointer(): void {
  if (!running) return;
  running = false;
  offFrames?.();
  offStatus?.();
  offFrames = null;
  offStatus = null;
  hide();
}

export type { CursorMode };

/** Re-renders only when the cursor mode changes (hidden, point, pressed, scroll), not on every frame. */
export function useAirCursorMode(): CursorMode {
  return useSyncExternalStore(
    (cb) => subscribeAirCursor(() => cb()),
    () => view.mode,
    () => 'hidden' as CursorMode,
  );
}
