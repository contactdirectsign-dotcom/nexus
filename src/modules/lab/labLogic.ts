// Pure helpers for the Gesture Lab (drawing strokes and the target game), kept free of the DOM so they can be tested.

export interface StrokePoint {
  /** 0..1 of the canvas width/height, so a drawing survives resizing. */
  x: number;
  y: number;
}

export interface Stroke {
  color: string;
  /** Brush width as a fraction of the canvas width. */
  width: number;
  points: StrokePoint[];
}

export const BRUSH_COLORS = [
  { name: 'Pink', value: '#ff2d95' },
  { name: 'Cyan', value: '#7ae7ff' },
  { name: 'Yellow', value: '#ffd166' },
  { name: 'Violet', value: '#c77dff' },
  { name: 'White', value: '#ffffff' },
] as const;

export const BRUSH_SIZES = [
  { name: 'Thin', value: 0.004 },
  { name: 'Medium', value: 0.009 },
  { name: 'Thick', value: 0.02 },
] as const;

/** Add a point unless it is practically where the last one is (keeps strokes small and smooth). */
export function addPoint(stroke: Stroke, p: StrokePoint, minDistance = 0.002): Stroke {
  const last = stroke.points[stroke.points.length - 1];
  if (last && Math.hypot(p.x - last.x, p.y - last.y) < minDistance) return stroke;
  return { ...stroke, points: [...stroke.points, p] };
}

/**
 * Points for a smooth curve: the midpoints between samples become curve ends and the samples become the
 * control points (the usual quadratic-midpoint trick). Returns segments to draw in order.
 */
export function smoothSegments(points: readonly StrokePoint[]): Array<{ from: StrokePoint; control: StrokePoint; to: StrokePoint }> {
  if (points.length < 3) return [];
  const mid = (a: StrokePoint, b: StrokePoint): StrokePoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const out: Array<{ from: StrokePoint; control: StrokePoint; to: StrokePoint }> = [];
  for (let i = 1; i < points.length - 1; i++) {
    out.push({ from: i === 1 ? points[0] : mid(points[i - 1], points[i]), control: points[i], to: mid(points[i], points[i + 1]) });
  }
  // Finish with a straight run from the last midpoint to the final sample, so the line reaches the pen position.
  const last = points[points.length - 1];
  const start = mid(points[points.length - 2], last);
  out.push({ from: start, control: mid(start, last), to: last });
  return out;
}

export interface TargetSpot {
  /** Centre as a percentage of the play area. */
  x: number;
  y: number;
}

/** A random spot that keeps the whole target inside the arena. `rand` returns 0..1 (injectable for tests). */
export function nextTarget(rand: () => number, previous?: TargetSpot): TargetSpot {
  const pick = (): TargetSpot => ({ x: 10 + rand() * 80, y: 14 + rand() * 72 });
  let spot = pick();
  // Never appear right on top of the previous one: that would be a free point.
  for (let i = 0; i < 5 && previous && Math.hypot(spot.x - previous.x, spot.y - previous.y) < 18; i++) spot = pick();
  return spot;
}

export interface GameResult {
  hits: number;
  misses: number;
  /** Hits per minute of play. */
  perMinute: number;
  accuracy: number;
}

export const GAME_SECONDS = 30;

export function summarize(hits: number, misses: number, seconds = GAME_SECONDS): GameResult {
  const total = hits + misses;
  return {
    hits,
    misses,
    perMinute: Math.round((hits / seconds) * 60),
    accuracy: total === 0 ? 0 : Math.round((hits / total) * 100),
  };
}

const BEST_KEY = 'nexus.lab.best.v1';

export function loadBest(): number {
  try {
    const n = Number(window.localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Saves a new high score; returns true when it beat the old one. */
export function saveBest(hits: number): boolean {
  if (hits <= loadBest()) return false;
  try {
    window.localStorage.setItem(BEST_KEY, String(Math.floor(hits)));
  } catch {
    /* kept for this visit only */
  }
  return true;
}
