import type { Landmarks, Point } from '../gestures/landmarks';
import type { GestureEvent, GestureTracker, HandFrame } from '../gestures/tracker';

export interface HandSpec {
  index?: boolean;
  middle?: boolean;
  ring?: boolean;
  pinky?: boolean;
  /** Move the index fingertip onto the thumb tip. */
  pinch?: boolean;
  /** Shift the whole hand (normalised frame units). */
  dx?: number;
  dy?: number;
}

const FINGER_BASES = [
  { x: -0.06, y: 0.71 }, // index
  { x: -0.02, y: 0.7 }, // middle
  { x: 0.02, y: 0.71 }, // ring
  { x: 0.06, y: 0.74 }, // pinky
];

/**
 * Build a synthetic upright right-hand-sized hand with 21 landmarks.
 * Defaults to an open palm. Straight fingers have tip/pip distance ratio ~1.3, curled ~0.7.
 */
export function makeHand(spec: HandSpec = {}): Landmarks {
  const flags = [spec.index ?? true, spec.middle ?? true, spec.ring ?? true, spec.pinky ?? true];
  const pts: Point[] = [];
  pts[0] = { x: 0.5, y: 0.9 };
  pts[1] = { x: 0.46, y: 0.86 };
  pts[2] = { x: 0.42, y: 0.8 };
  pts[3] = { x: 0.38, y: 0.76 };
  pts[4] = { x: 0.35, y: 0.72 };

  FINGER_BASES.forEach((b, i) => {
    const x = 0.5 + b.x;
    const base = 5 + i * 4;
    const pipY = b.y - 0.09;
    pts[base] = { x, y: b.y }; // mcp
    pts[base + 1] = { x, y: pipY }; // pip
    if (flags[i]) {
      pts[base + 2] = { x, y: pipY - 0.05 };
      pts[base + 3] = { x, y: pipY - 0.09 };
    } else {
      pts[base + 2] = { x, y: pipY + 0.05 };
      pts[base + 3] = { x, y: pipY + 0.09 };
    }
  });

  if (spec.pinch) pts[8] = { x: pts[4].x + 0.01, y: pts[4].y };

  const dx = spec.dx ?? 0;
  const dy = spec.dy ?? 0;
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy, z: 0 }));
}

export interface TestFrame {
  t: number;
  hand?: HandSpec | null;
  label?: 'Left' | 'Right';
}

/** Feed frames to a tracker and collect every event. `null`/missing hand means "no hand". */
export function run(tracker: GestureTracker, frames: TestFrame[]): GestureEvent[] {
  const out: GestureEvent[] = [];
  for (const f of frames) {
    const hands: HandFrame[] = f.hand ? [{ landmarks: makeHand(f.hand), label: f.label ?? 'Left', score: 0.95 }] : [];
    out.push(...tracker.update(f.t, hands));
  }
  return out;
}

/** Frames every `step` ms from `from` to `to`, with the hand spec produced per timestamp. */
export function frames(from: number, to: number, hand: (t: number) => HandSpec | null, step = 50): TestFrame[] {
  const list: TestFrame[] = [];
  for (let t = from; t <= to; t += step) list.push({ t, hand: hand(t) });
  return list;
}

export const names = (events: GestureEvent[]): string[] => events.map((e) => e.gesture);
