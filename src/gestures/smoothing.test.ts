import { describe, expect, it } from 'vitest';
import { makeHand } from '../test/hands';
import { LandmarkSmoother } from './smoothing';

describe('LandmarkSmoother', () => {
  it('returns the first frame unchanged', () => {
    const s = new LandmarkSmoother();
    const hand = makeHand();
    const out = s.apply(0, hand);
    expect(out[8].x).toBeCloseTo(hand[8].x);
    expect(out[8].y).toBeCloseTo(hand[8].y);
  });

  it('reduces jitter on a still hand', () => {
    const s = new LandmarkSmoother();
    let rawTravel = 0;
    let smoothTravel = 0;
    let prevRaw = makeHand();
    let prevSmooth = s.apply(0, prevRaw);
    for (let i = 1; i <= 40; i++) {
      const jitter = i % 2 === 0 ? 0.004 : -0.004;
      const raw = makeHand({ dx: jitter, dy: -jitter });
      const smooth = s.apply(i * 50, raw);
      rawTravel += Math.abs(raw[8].x - prevRaw[8].x);
      smoothTravel += Math.abs(smooth[8].x - prevSmooth[8].x);
      prevRaw = raw;
      prevSmooth = smooth;
    }
    expect(smoothTravel).toBeLessThan(rawTravel * 0.6);
  });

  it('still follows fast movement closely', () => {
    const s = new LandmarkSmoother();
    s.apply(0, makeHand());
    let out = s.apply(50, makeHand());
    for (let i = 1; i <= 6; i++) out = s.apply(50 + i * 50, makeHand({ dx: -i * 0.06 }));
    const target = makeHand({ dx: -0.36 });
    expect(Math.abs(out[8].x - target[8].x)).toBeLessThan(0.1);
  });

  it('restarts after a long gap or reset', () => {
    const s = new LandmarkSmoother();
    s.apply(0, makeHand());
    const far = makeHand({ dx: 0.3 });
    expect(s.apply(2000, far)[8].x).toBeCloseTo(far[8].x);
    s.reset();
    const again = makeHand({ dx: -0.2 });
    expect(s.apply(2050, again)[8].x).toBeCloseTo(again[8].x);
  });
});
