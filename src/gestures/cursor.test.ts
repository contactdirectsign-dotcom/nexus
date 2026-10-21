import { describe, expect, it } from 'vitest';
import { makeHand, type HandSpec } from '../test/hands';
import { AirCursorTracker, handShape } from './cursor';
import type { Landmarks, Point } from './landmarks';

const POINT: HandSpec = { index: true, middle: false, ring: false, pinky: false };
const TWO: HandSpec = { index: true, middle: true, ring: false, pinky: false };
const PALM: HandSpec = {};
const FIST: HandSpec = { index: false, middle: false, ring: false, pinky: false };

/** A hand of the given shape whose index fingertip is at (x, y); the thumb tip sits `gap` to its left. */
function hand(x: number, y: number, gap = 0.2, spec: HandSpec = POINT): Landmarks {
  const base = makeHand(spec);
  const dx = x - base[8].x;
  const dy = y - base[8].y;
  const pts = base.map((p): Point => ({ x: p.x + dx, y: p.y + dy, z: 0 }));
  pts[4] = { x: x - gap, y, z: 0 };
  return pts;
}

/** Only the fingertip drifts (the finger flexes); the rest of the hand stays where it is. */
function flexed(dx: number, dy: number, gap: number): Landmarks {
  const pts: Point[] = [...hand(0.5, 0.5, gap)];
  pts[8] = { x: pts[8].x + dx, y: pts[8].y + dy, z: 0 };
  pts[4] = { x: pts[8].x - gap, y: pts[8].y, z: 0 };
  return pts;
}

const feed = (c: AirCursorTracker, from: number, to: number, f: (t: number) => Landmarks, step = 33) => {
  const events: string[] = [];
  let state = c.getState();
  for (let t = from; t <= to; t += step) {
    const r = c.update(t, f(t));
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
};

describe('hand shape (decided from a single frame)', () => {
  it('recognises pointing, two fingers, and ignores palm and fist', () => {
    expect(handShape(hand(0.5, 0.5, 0.2, POINT), 4 / 3, 0.62)).toBe('point');
    expect(handShape(hand(0.5, 0.5, 0.2, TWO), 4 / 3, 0.62)).toBe('two');
    expect(handShape(hand(0.5, 0.5, 0.2, PALM), 4 / 3, 0.62)).toBe('none');
    expect(handShape(hand(0.5, 0.5, 0.2, FIST), 4 / 3, 0.62)).toBe('none');
  });

  it('a fist is never a pinch, even with the thumb touching the index', () => {
    expect(handShape(hand(0.5, 0.7, 0.005, FIST), 4 / 3, 0.62)).toBe('none');
  });

  it('an OK-style pinch (index curled to the thumb, other fingers up) still shows the cursor', () => {
    const ok = hand(0.5, 0.7, 0.005, { index: false, middle: true, ring: true, pinky: true });
    expect(handShape(ok, 4 / 3, 0.62)).toBe('point');
  });
});

describe('appears at once', () => {
  it('shows on the very first frame the index finger is up', () => {
    const c = new AirCursorTracker();
    expect(c.update(0, hand(0.5, 0.5)).state.mode).toBe('point');
  });

  it('shows after a hand appears with the finger already up, and not for an open palm', () => {
    const c = new AirCursorTracker();
    expect(c.update(0, hand(0.5, 0.5, 0.2, PALM)).state.mode).toBe('hidden');
    expect(c.update(33, hand(0.5, 0.5, 0.2, POINT)).state.mode).toBe('point');
  });
});

describe('mapping to the screen', () => {
  it('mirrors x and uses the middle of the frame for the whole screen', () => {
    const c = new AirCursorTracker({ marginX: 0.2, marginY: 0.1 });
    const mid = feed(c, 0, 300, () => hand(0.5, 0.5)).state;
    expect(mid.x).toBeCloseTo(0.5, 1);
    expect(mid.y).toBeCloseTo(0.5, 1);
    const c2 = new AirCursorTracker({ marginX: 0.2, marginY: 0.1 });
    const edge = feed(c2, 0, 300, () => hand(0.2, 0.1)).state;
    expect(edge.x).toBeCloseTo(1, 1);
    expect(edge.y).toBeCloseTo(0, 1);
  });

  it('clamps outside the margins instead of leaving the screen', () => {
    const c = new AirCursorTracker();
    const s = feed(c, 0, 300, () => hand(0.02, 0.3)).state;
    expect(s.x).toBeLessThanOrEqual(1);
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.mode).toBe('point');
  });

  it('is steady when the hand jitters slightly', () => {
    const c = new AirCursorTracker();
    let minX = 1;
    let maxX = 0;
    for (let i = 0; i < 60; i++) {
      const j = i % 2 ? 0.004 : -0.004;
      const s = c.update(i * 33, hand(0.5 + j, 0.5)).state;
      if (i > 20) {
        minX = Math.min(minX, s.x);
        maxX = Math.max(maxX, s.x);
      }
    }
    expect(maxX - minX).toBeLessThan(0.008);
  });

  it('follows quick movement without much delay', () => {
    const c = new AirCursorTracker({ marginX: 0, marginY: 0, mirror: false });
    feed(c, 0, 300, () => hand(0.2, 0.5));
    const s = feed(c, 333, 333 + 400, (t) => hand(0.2 + ((t - 333) / 400) * 0.6, 0.5)).state;
    expect(s.x).toBeGreaterThan(0.72); // target is 0.8
    expect(s.x).toBeLessThanOrEqual(1);
  });

  it('does not overshoot when the hand stops', () => {
    const c = new AirCursorTracker({ marginX: 0, marginY: 0, mirror: false });
    feed(c, 0, 200, () => hand(0.2, 0.5));
    feed(c, 233, 500, (t) => hand(0.2 + ((t - 233) / 267) * 0.5, 0.5)); // fast move to 0.7
    const settled = feed(c, 533, 1200, () => hand(0.7, 0.5)).state;
    expect(Math.abs(settled.x - 0.7)).toBeLessThan(0.02);
  });
});

describe('visibility', () => {
  it('hides for a fist or open palm (after a short grace) and returns for pointing', () => {
    const c = new AirCursorTracker();
    expect(feed(c, 0, 200, () => hand(0.5, 0.5)).state.mode).toBe('point');
    expect(feed(c, 233, 600, () => hand(0.5, 0.5, 0.2, FIST)).state.mode).toBe('hidden');
    expect(feed(c, 633, 800, () => hand(0.5, 0.5, 0.2, POINT)).state.mode).toBe('point');
    expect(feed(c, 833, 1200, () => hand(0.5, 0.5, 0.2, PALM)).state.mode).toBe('hidden');
  });

  it('survives a one-frame flicker', () => {
    const c = new AirCursorTracker();
    feed(c, 0, 200, () => hand(0.5, 0.5));
    expect(c.update(233, hand(0.5, 0.5, 0.2, FIST)).state.mode).toBe('point');
  });

  it('releases a press if the hand disappears', () => {
    const c = new AirCursorTracker();
    feed(c, 0, 200, () => hand(0.5, 0.5));
    const r = feed(c, 233, 500, (t) => hand(0.5, 0.5, t < 300 ? 0.2 : 0.01));
    expect(r.events).toContain('down');
    expect(c.lost()).toEqual(['up']);
  });
});

describe('pinch click', () => {
  it('presses once when the pinch closes and releases when it opens', () => {
    const c = new AirCursorTracker();
    const aim = feed(c, 0, 300, () => hand(0.5, 0.5));
    expect(aim.events).toEqual([]);
    const closing = feed(c, 333, 700, (t) => hand(0.5, 0.5, 0.2 - Math.min(1, (t - 333) / 200) * 0.19));
    expect(closing.events).toEqual(['down']);
    expect(closing.state.mode).toBe('pressed');
    const opening = feed(c, 733, 1100, (t) => hand(0.5, 0.5, 0.01 + Math.min(1, (t - 733) / 200) * 0.2));
    expect(opening.events).toEqual(['up']);
    expect(opening.state.mode).toBe('point');
  });

  it('clicks where you aimed, even when closing the pinch pushes the fingertip away', () => {
    const c = new AirCursorTracker({ marginX: 0, marginY: 0, mirror: false });
    feed(c, 0, 400, () => hand(0.5, 0.5));
    let downAt = { x: -1, y: -1 };
    for (let t = 433; t <= 800; t += 33) {
      const k = Math.min(1, (t - 433) / 250);
      const r = c.update(t, flexed(k * 0.08, k * 0.08, 0.2 - k * 0.19));
      if (r.events.includes('down')) downAt = { x: r.state.x, y: r.state.y };
    }
    expect(downAt.x).toBeGreaterThan(0);
    expect(Math.abs(downAt.x - 0.5)).toBeLessThan(0.04);
    expect(Math.abs(downAt.y - 0.5)).toBeLessThan(0.04);
  });

  it('does not press when the thumb only comes part of the way', () => {
    const c = new AirCursorTracker();
    feed(c, 0, 300, () => hand(0.5, 0.5));
    const r = feed(c, 333, 900, () => hand(0.5, 0.5, 0.1));
    expect(r.events).not.toContain('down');
  });

  it('drags by moving the palm while pinched', () => {
    const c = new AirCursorTracker({ marginX: 0, marginY: 0, mirror: false });
    feed(c, 0, 300, () => hand(0.4, 0.5));
    feed(c, 333, 600, (t) => hand(0.4, 0.5, 0.2 - Math.min(1, (t - 333) / 150) * 0.19));
    const before = c.getState();
    expect(before.mode).toBe('pressed');
    const after = feed(c, 633, 1000, (t) => hand(0.4 + Math.min(1, (t - 633) / 300) * 0.2, 0.5, 0.01)).state;
    expect(after.x).toBeGreaterThan(before.x + 0.15);
  });
});

describe('switching modes', () => {
  it('a half-closed pinch does not leave the cursor stuck when you switch to scrolling', () => {
    const c = new AirCursorTracker({ marginX: 0, marginY: 0, mirror: false });
    feed(c, 0, 200, () => hand(0.3, 0.4));
    feed(c, 233, 330, () => hand(0.3, 0.4, 0.1)); // closing in: the aim point freezes
    const moved = feed(c, 363, 900, (t) => hand(0.3 + ((t - 363) / 537) * 0.4, 0.4, 0.2, TWO)).state;
    expect(moved.mode).toBe('scroll');
    expect(moved.x).toBeGreaterThan(0.55); // followed the hand (ends near 0.7)
  });
});

describe('two-finger scroll', () => {
  it('reports vertical movement and never presses', () => {
    const c = new AirCursorTracker({ marginX: 0, marginY: 0 });
    feed(c, 0, 200, () => hand(0.5, 0.3, 0.2, TWO));
    let total = 0;
    for (let t = 233; t <= 700; t += 33) {
      const r = c.update(t, hand(0.5, 0.3 + ((t - 233) / 467) * 0.3, 0.2, TWO));
      total += r.state.scrollDy;
      expect(r.state.mode).toBe('scroll');
      expect(r.events).toEqual([]);
    }
    expect(total).toBeGreaterThan(0.15);
  });
});

describe('Phase 3.4 cursor', () => {
  it('shows the cursor when the recogniser says pointing even if the quick check disagrees', () => {
    const t = new AirCursorTracker();
    const lm = makeHand(); // open palm: the quick check says "none"
    expect(handShape(lm, 4 / 3, 0.62)).toBe('none');
    expect(t.update(0, lm, true).state.mode).toBe('point');
    expect(t.debug().hinted).toBe(true);
  });
  it('without a hint an open palm stays hidden', () => {
    const t = new AirCursorTracker();
    expect(t.update(0, makeHand(), false).state.mode).toBe('hidden');
  });
});

describe('click accuracy', () => {
  it('a click aims where the finger was before the pinch began, even when the tip drifts while closing', () => {
    const c = new AirCursorTracker();
    const settled = feed(c, 0, 400, () => hand(0.5, 0.5, 0.3)).state;
    let downAt: { x: number; y: number } | null = null;
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      const r = c.update(430 + i * 16, flexed(0.06 * k, 0.05 * k, 0.3 - 0.27 * k));
      if (r.events.includes('down')) downAt = { x: r.state.x, y: r.state.y };
    }
    expect(downAt).not.toBeNull();
    expect(Math.hypot(downAt!.x - settled.x, downAt!.y - settled.y)).toBeLessThan(0.03);
  });
});

describe('click and drag steadiness', () => {
  it('a drag is smooth: no jumps from landmark jitter', () => {
    const c = new AirCursorTracker({ marginX: 0, marginY: 0, mirror: false });
    feed(c, 0, 300, () => hand(0.4, 0.5, 0.3));
    feed(c, 333, 500, () => hand(0.4, 0.5, 0.03)); // pinch
    let prev: number | null = null;
    let worst = 0;
    for (let t = 533; t <= 1100; t += 33) {
      const jitter = (Math.sin(t) * 0.004);
      const r = c.update(t, hand(0.4 + (t - 533) * 0.0003 + jitter, 0.5, 0.03));
      if (r.state.mode === 'pressed') {
        if (prev !== null) worst = Math.max(worst, Math.abs(r.state.x - prev));
        prev = r.state.x;
      }
    }
    expect(prev).not.toBeNull();
    expect(worst).toBeLessThan(0.03);
  });
  it('letting go happens where the drag was, not where the opening fingers wandered', () => {
    const c = new AirCursorTracker({ marginX: 0, marginY: 0, mirror: false });
    feed(c, 0, 300, () => hand(0.4, 0.5, 0.3));
    feed(c, 333, 600, () => hand(0.4, 0.5, 0.03));
    let up: { x: number; y: number } | null = null;
    for (let i = 0; i < 6; i++) {
      const k = i / 5;
      const r = c.update(633 + i * 33, hand(0.4, 0.5, 0.03 + 0.5 * k));
      if (r.events.includes('up')) up = { x: r.state.x, y: r.state.y };
    }
    expect(up).not.toBeNull();
    expect(Math.abs(up!.x - 0.4)).toBeLessThan(0.06);
  });
  it('one noisy frame in the middle of a pinch does not release it', () => {
    const c = new AirCursorTracker();
    feed(c, 0, 300, () => hand(0.5, 0.5, 0.3));
    feed(c, 333, 500, () => hand(0.5, 0.5, 0.03));
    const r = feed(c, 533, 533, () => hand(0.5, 0.5, 0.5));
    const r2 = feed(c, 566, 600, () => hand(0.5, 0.5, 0.03));
    expect([...r.events, ...r2.events]).not.toContain('up');
  });
});
