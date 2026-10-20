import { describe, expect, it } from 'vitest';
import { makeHand } from '../test/hands';
import { AirCursorTracker } from './cursor';
import type { Landmarks, Point } from './landmarks';
import type { PoseId } from './recognizer';

/** Pointing hand whose index fingertip is at (x, y) in the camera frame, with a given pinch gap. */
function hand(x: number, y: number, gap = 0.2): Landmarks {
  const base = makeHand({ index: true, middle: false, ring: false, pinky: false });
  const pts = base.map((p): Point => ({ ...p }));
  pts[8] = { x, y, z: 0 };
  pts[4] = { x: x - gap, y, z: 0 }; // thumb tip next to the index tip
  return pts;
}

const feed = (c: AirCursorTracker, from: number, to: number, f: (t: number) => { lm: Landmarks; pose: PoseId }, step = 33) => {
  const events: string[] = [];
  let state = c.getState();
  for (let t = from; t <= to; t += step) {
    const { lm, pose } = f(t);
    const r = c.update(t, lm, pose);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
};

describe('mapping to the screen', () => {
  it('mirrors x and uses the middle of the frame for the whole screen', () => {
    const c = new AirCursorTracker({ marginX: 0.2, marginY: 0.1 });
    const mid = feed(c, 0, 300, () => ({ lm: hand(0.5, 0.5), pose: 'pointing' })).state;
    expect(mid.x).toBeCloseTo(0.5, 1);
    expect(mid.y).toBeCloseTo(0.5, 1);
    const c2 = new AirCursorTracker({ marginX: 0.2, marginY: 0.1 });
    // raw x 0.2 (margin edge) is the far RIGHT of a mirrored screen; raw y 0.1 is the top
    const edge = feed(c2, 0, 300, () => ({ lm: hand(0.2, 0.1), pose: 'pointing' })).state;
    expect(edge.x).toBeCloseTo(1, 1);
    expect(edge.y).toBeCloseTo(0, 1);
  });

  it('clamps outside the margins instead of leaving the screen', () => {
    const c = new AirCursorTracker();
    const s = feed(c, 0, 300, () => ({ lm: hand(0.02, 0.98), pose: 'pointing' })).state;
    expect(s.x).toBeLessThanOrEqual(1);
    expect(s.y).toBeLessThanOrEqual(1);
    expect(s.x).toBeGreaterThanOrEqual(0);
  });

  it('is steady when the hand jitters slightly', () => {
    const c = new AirCursorTracker();
    let minX = 1;
    let maxX = 0;
    for (let i = 0; i < 60; i++) {
      const j = i % 2 ? 0.004 : -0.004;
      const s = c.update(i * 33, hand(0.5 + j, 0.5), 'pointing').state;
      if (i > 20) {
        minX = Math.min(minX, s.x);
        maxX = Math.max(maxX, s.x);
      }
    }
    expect(maxX - minX).toBeLessThan(0.008); // raw jitter is 0.008/0.68 = about 0.012 on screen
  });

  it('follows quick movement without much delay', () => {
    const c = new AirCursorTracker({ marginX: 0, marginY: 0, mirror: false });
    feed(c, 0, 300, () => ({ lm: hand(0.2, 0.5), pose: 'pointing' }));
    const s = feed(c, 333, 333 + 400, (t) => ({ lm: hand(0.2 + ((t - 333) / 400) * 0.6, 0.5), pose: 'pointing' })).state;
    expect(s.x).toBeGreaterThan(0.7); // target is 0.8
  });
});

describe('visibility', () => {
  it('shows for pointing and hides for a fist or open palm (after a short grace)', () => {
    const c = new AirCursorTracker();
    expect(feed(c, 0, 200, () => ({ lm: hand(0.5, 0.5), pose: 'pointing' })).state.mode).toBe('point');
    expect(feed(c, 233, 500, () => ({ lm: hand(0.5, 0.5), pose: 'closed-fist' })).state.mode).toBe('hidden');
    feed(c, 533, 700, () => ({ lm: hand(0.5, 0.5), pose: 'pointing' }));
    expect(feed(c, 733, 1000, () => ({ lm: hand(0.5, 0.5), pose: 'open-palm' })).state.mode).toBe('hidden');
  });

  it('survives a one-frame pose flicker', () => {
    const c = new AirCursorTracker();
    feed(c, 0, 200, () => ({ lm: hand(0.5, 0.5), pose: 'pointing' }));
    expect(c.update(233, hand(0.5, 0.5), 'none').state.mode).toBe('point');
  });

  it('releases a press if the hand disappears', () => {
    const c = new AirCursorTracker();
    feed(c, 0, 200, () => ({ lm: hand(0.5, 0.5), pose: 'pointing' }));
    const r = feed(c, 233, 500, (t) => ({ lm: hand(0.5, 0.5, t < 300 ? 0.2 : 0.01), pose: 'pinch' }));
    expect(r.events).toContain('down');
    expect(c.lost()).toEqual(['up']);
  });
});

describe('pinch click', () => {
  it('presses once when the pinch closes and releases when it opens', () => {
    const c = new AirCursorTracker();
    const aim = feed(c, 0, 300, () => ({ lm: hand(0.5, 0.5), pose: 'pointing' }));
    expect(aim.events).toEqual([]);
    const closing = feed(c, 333, 700, (t) => ({ lm: hand(0.5, 0.5, 0.2 - Math.min(1, (t - 333) / 200) * 0.19), pose: 'pinch' }));
    expect(closing.events).toEqual(['down']);
    expect(closing.state.mode).toBe('pressed');
    const opening = feed(c, 733, 1100, (t) => ({ lm: hand(0.5, 0.5, 0.01 + Math.min(1, (t - 733) / 200) * 0.2), pose: 'pointing' }));
    expect(opening.events).toEqual(['up']);
    expect(opening.state.mode).toBe('point');
  });

  it('clicks where you aimed, even when closing the pinch pushes the fingertip away', () => {
    const c = new AirCursorTracker({ marginX: 0, marginY: 0, mirror: false });
    feed(c, 0, 400, () => ({ lm: hand(0.5, 0.5), pose: 'pointing' }));
    let downAt = { x: -1, y: -1 };
    for (let t = 433; t <= 800; t += 33) {
      const k = Math.min(1, (t - 433) / 250);
      // the fingertip drifts 0.08 to the right and down while the pinch closes
      const lm = hand(0.5 + k * 0.08, 0.5 + k * 0.08, 0.2 - k * 0.19);
      const r = c.update(t, lm, 'pinch');
      if (r.events.includes('down')) downAt = { x: r.state.x, y: r.state.y };
    }
    expect(downAt.x).toBeGreaterThan(0);
    expect(Math.abs(downAt.x - 0.5)).toBeLessThan(0.04);
    expect(Math.abs(downAt.y - 0.5)).toBeLessThan(0.04);
  });

  it('does not press when the thumb only comes part of the way', () => {
    const c = new AirCursorTracker();
    feed(c, 0, 300, () => ({ lm: hand(0.5, 0.5), pose: 'pointing' }));
    const r = feed(c, 333, 900, () => ({ lm: hand(0.5, 0.5, 0.1), pose: 'pointing' }));
    expect(r.events).not.toContain('down');
  });

  it('drags by moving the palm while pinched', () => {
    const c = new AirCursorTracker({ marginX: 0, marginY: 0, mirror: false });
    feed(c, 0, 300, () => ({ lm: hand(0.4, 0.5), pose: 'pointing' }));
    feed(c, 333, 600, (t) => ({ lm: hand(0.4, 0.5, 0.2 - Math.min(1, (t - 333) / 150) * 0.19), pose: 'pinch' }));
    const before = c.getState();
    expect(before.mode).toBe('pressed');
    // move the whole hand right by 0.2 while keeping the pinch closed
    const after = feed(c, 633, 1000, (t) => {
      const dx = Math.min(1, (t - 633) / 300) * 0.2;
      const base = hand(0.4 + dx, 0.5, 0.01);
      return { lm: base.map((p) => ({ ...p, x: p.x + (p === base[8] || p === base[4] ? 0 : dx) })), pose: 'pinch' };
    }).state;
    expect(after.x).toBeGreaterThan(before.x + 0.15);
  });
});

describe('two-finger scroll', () => {
  it('reports vertical movement and never presses', () => {
    const c = new AirCursorTracker({ marginX: 0, marginY: 0 });
    feed(c, 0, 200, () => ({ lm: hand(0.5, 0.3), pose: 'two-finger' }));
    let total = 0;
    for (let t = 233; t <= 700; t += 33) {
      const r = c.update(t, hand(0.5, 0.3 + ((t - 233) / 467) * 0.3), 'two-finger');
      total += r.state.scrollDy;
      expect(r.state.mode).toBe('scroll');
      expect(r.events).toEqual([]);
    }
    expect(total).toBeGreaterThan(0.15); // moved down about 0.3, smoothed
  });
});
