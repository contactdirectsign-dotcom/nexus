import type { Landmarks, Point } from './landmarks';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Adaptive smoothing for hand landmarks (an exponential moving average whose strength depends on each
 * point's speed). A still hand is smoothed strongly, which removes the camera jitter that makes poses flicker and the
 * skeleton shake. A fast-moving hand is smoothed lightly so swipes still feel responsive.
 */
export class LandmarkSmoother {
  private prev: Point[] | null = null;
  private prevT = 0;

  constructor(
    private readonly minAlpha = 0.25,
    private readonly maxAlpha = 0.85,
  ) {}

  reset(): void {
    this.prev = null;
  }

  apply(t: number, lm: Landmarks): Landmarks {
    const prev = this.prev;
    if (!prev || prev.length !== lm.length || t - this.prevT > 500) {
      this.prev = lm.map((p) => ({ x: p.x, y: p.y, z: p.z }));
      this.prevT = t;
      return this.prev;
    }
    const dt = Math.max(1, t - this.prevT) / 1000;
    // Each landmark is smoothed by its own speed (frame-widths per second): a jittering fingertip is
    // smoothed hard, but a finger that really moves (curling into a pinch) is followed quickly.
    const next = lm.map((p, i) => {
      const speed = Math.hypot(p.x - prev[i].x, p.y - prev[i].y) / dt;
      const alpha = this.minAlpha + (this.maxAlpha - this.minAlpha) * clamp01(speed / 1.2);
      return {
        x: prev[i].x + alpha * (p.x - prev[i].x),
        y: prev[i].y + alpha * (p.y - prev[i].y),
        z: p.z,
      };
    });
    this.prev = next;
    this.prevT = t;
    return next;
  }
}
