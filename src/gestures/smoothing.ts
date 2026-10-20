import type { Landmarks, Point } from './landmarks';

/**
 * One Euro filter per landmark (Casiez et al., 2012): the standard low-lag smoother for tracked hands.
 * A still hand is smoothed strongly (no jitter, steady poses); the more a point moves, the less it is
 * smoothed, so quick swipes and finger curls are followed almost without delay.
 *
 *   cutoff = minCutoff + beta * speed        (speed in frame-widths per second)
 *
 * Higher minCutoff = less smoothing when still. Higher beta = follows fast movement more closely.
 */
export class LandmarkSmoother {
  private prev: Point[] | null = null;
  private vel: Array<{ x: number; y: number }> = [];
  private prevT = 0;

  constructor(
    private readonly minCutoff = 2,
    private readonly beta = 20,
    private readonly dCutoff = 1.5,
  ) {}

  reset(): void {
    this.prev = null;
    this.vel = [];
  }

  apply(t: number, lm: Landmarks): Landmarks {
    const prev = this.prev;
    if (!prev || prev.length !== lm.length || t - this.prevT > 500 || t <= this.prevT) {
      this.prev = lm.map((p) => ({ x: p.x, y: p.y, z: p.z }));
      this.vel = lm.map(() => ({ x: 0, y: 0 }));
      this.prevT = t;
      return this.prev;
    }
    const dt = Math.max(0.001, (t - this.prevT) / 1000);
    const alphaFor = (cutoff: number): number => {
      const tau = 1 / (2 * Math.PI * cutoff);
      return 1 / (1 + tau / dt);
    };
    const aD = alphaFor(this.dCutoff);

    const next = lm.map((p, i) => {
      const last = prev[i];
      // Smoothed speed of this point
      const rawVx = (p.x - last.x) / dt;
      const rawVy = (p.y - last.y) / dt;
      const v = this.vel[i];
      v.x += aD * (rawVx - v.x);
      v.y += aD * (rawVy - v.y);
      const a = alphaFor(this.minCutoff + this.beta * Math.hypot(v.x, v.y));
      return { x: last.x + a * (p.x - last.x), y: last.y + a * (p.y - last.y), z: p.z };
    });
    this.prev = next;
    this.prevT = t;
    return next;
  }
}
