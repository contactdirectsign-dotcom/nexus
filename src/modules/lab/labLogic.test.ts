import { beforeEach, describe, expect, it } from 'vitest';
import { addPoint, GAME_SECONDS, loadBest, nextTarget, saveBest, smoothSegments, summarize, type Stroke } from './labLogic';

const stroke = (pts: Array<[number, number]>): Stroke => ({ color: '#fff', width: 0.01, points: pts.map(([x, y]) => ({ x, y })) });

describe('strokes', () => {
  it('skips points that barely moved', () => {
    let s = stroke([[0.5, 0.5]]);
    s = addPoint(s, { x: 0.5005, y: 0.5 });
    expect(s.points).toHaveLength(1);
    s = addPoint(s, { x: 0.6, y: 0.5 });
    expect(s.points).toHaveLength(2);
  });

  it('makes a smooth curve through the samples', () => {
    expect(smoothSegments(stroke([[0, 0], [1, 1]]).points)).toEqual([]);
    const seg = smoothSegments(stroke([[0, 0], [0.5, 0.2], [1, 0], [1.5, 0.2]]).points);
    expect(seg.length).toBe(3);
    expect(seg[0].from).toEqual({ x: 0, y: 0 });
    expect(seg[seg.length - 1].to).toEqual({ x: 1.5, y: 0.2 });
    // each segment starts where the previous one ended (no gaps)
    for (let i = 1; i < seg.length; i++) expect(seg[i].from).toEqual(seg[i - 1].to);
  });
});

describe('target game', () => {
  it('keeps targets inside the arena, away from the previous spot', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    let prev = nextTarget(rand);
    for (let i = 0; i < 200; i++) {
      const t = nextTarget(rand, prev);
      expect(t.x).toBeGreaterThanOrEqual(10);
      expect(t.x).toBeLessThanOrEqual(90);
      expect(t.y).toBeGreaterThanOrEqual(14);
      expect(t.y).toBeLessThanOrEqual(86);
      prev = t;
    }
  });

  it('summarises a round', () => {
    expect(summarize(15, 5)).toEqual({ hits: 15, misses: 5, perMinute: Math.round((15 / GAME_SECONDS) * 60), accuracy: 75 });
    expect(summarize(0, 0).accuracy).toBe(0);
  });

  it('remembers the best score only when beaten', () => {
    window.localStorage.clear();
    expect(loadBest()).toBe(0);
    expect(saveBest(12)).toBe(true);
    expect(saveBest(10)).toBe(false);
    expect(saveBest(12)).toBe(false);
    expect(loadBest()).toBe(12);
    expect(saveBest(13)).toBe(true);
  });

  beforeEach(() => window.localStorage.clear());
});
