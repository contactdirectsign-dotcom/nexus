import { dist, LM, palmCenter, type Landmarks } from './landmarks';
import { fingerRatios } from './recognizer';

/**
 * Air cursor: turns your index fingertip into a pointer that covers the whole screen.
 *
 *  - Point with your index finger to move the cursor. It appears the instant the index finger is up (judged here,
 *    frame by frame, not from the slower, debounced gesture classifier).
 *  - Pinch thumb and index to press; keep pinching and move to drag; open to release.
 *  - Hold up two fingers and move up/down to scroll (or zoom, over the globe).
 *
 * Pure logic (no camera, no DOM) so every rule can be tested. Hard problems solved here:
 *  1. Reach: only the middle part of the camera frame maps to the screen, so you never reach for the edges.
 *  2. Aim: the position is smoothed with a One Euro filter (steady when slow, quick when fast).
 *  3. Pinch drift: closing a pinch moves the fingertip. When a pinch starts to close, the cursor freezes at
 *     where it was ~120 ms earlier, so you click what you aimed at, not what the pinch pushed you onto.
 *  4. Dragging: while pressed, the cursor follows your PALM (steady), not the pinching fingertips.
 */

export interface CursorConfig {
  /** Camera margins (fraction of the frame) that are cut off, so the middle maps to the whole screen. */
  marginX: number;
  marginY: number;
  /** Pinch distance / palm size below which the press starts, and above which it is released. */
  pressRatio: number;
  releaseRatio: number;
  /** Pinch ratio at which the cursor freezes (hand is closing in on a click). */
  approachRatio: number;
  /** Mirror x (front camera shown as a mirror). */
  mirror: boolean;
  /** Video width / height. */
  aspect: number;
}

export const DEFAULT_CURSOR_CONFIG: CursorConfig = {
  marginX: 0.16,
  marginY: 0.14,
  pressRatio: 0.3,
  releaseRatio: 0.6,
  approachRatio: 0.8,
  mirror: true,
  aspect: 4 / 3,
};

export type CursorMode = 'hidden' | 'point' | 'pressed' | 'scroll';

export interface CursorState {
  mode: CursorMode;
  /** Screen position as a fraction 0..1 of width / height. */
  x: number;
  y: number;
  /** 0 (open) .. 1 (pinched): used to shrink the cursor ring while you pinch. */
  closing: number;
  /** In scroll mode: how far the fingertip moved this frame (screen height fractions, down is positive). */
  scrollDy: number;
}

export type CursorEvent = 'down' | 'up';

export const HIDDEN_CURSOR: CursorState = { mode: 'hidden', x: 0.5, y: 0.5, closing: 0, scrollDy: 0 };

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const HISTORY_MS = 500;
const FREEZE_LOOKBACK_MS = 220;
/** A pinch that closes this fast (ratio units within 120 ms) freezes the aim even before the approach distance. */
const CLOSE_RATE = 0.14;
const CLOSE_WINDOW_MS = 120;
const CLOSE_MAX_RATIO = 1.15;
const FREEZE_TIMEOUT_MS = 550;
const HIDE_GRACE_MS = 220;
const DRAG_GAIN = 1.25;
/** Look a little ahead on fast movement to hide the camera's own delay (seconds). Zero effect when slow. */
const LEAD_S = 0.02;
const LEAD_FROM_SPEED = 0.35;
const LEAD_FULL_SPEED = 0.9;
const INDEX_UP_RATIO = 0.95;
const FINGER_UP_RATIO = 1.0;
const POINT_LEAD = 0.28;

export type HandShape = 'point' | 'two' | 'none';

/**
 * What the hand is doing, for the cursor only (decided from one frame, no waiting):
 *  - 'point': index finger up and the middle finger down, or a pinch closing in with some fingers up.
 *  - 'two': index and middle up, ring down (scroll).
 *  - 'none': open palm (swipe/pause hand), fist, or anything else.
 */
export function handShape(lm: Landmarks, aspect: number, approachRatio: number): HandShape {
  if (lm.length < 21) return 'none';
  const [index, middle, ring, pinky] = fingerRatios(lm, aspect);
  const indexUp = index > INDEX_UP_RATIO;
  const middleUp = middle > FINGER_UP_RATIO;
  const ringUp = ring > FINGER_UP_RATIO;
  const pinkyUp = pinky > FINGER_UP_RATIO;
  if (indexUp && !middleUp) return 'point';
  // Middle finger only half-curled still counts as pointing: the index must clearly be the longest finger.
  if (indexUp && !ringUp && !pinkyUp && index - middle > POINT_LEAD) return 'point';
  if (indexUp && middleUp && !ringUp) return 'two';
  // "OK" style pinch: the index curls toward the thumb while other fingers stay up. A fist must not count.
  const handSize = Math.max(1e-6, dist(lm[LM.WRIST], lm[LM.MIDDLE_MCP], aspect));
  const pinch = dist(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP], aspect) / handSize;
  if (pinch < approachRatio && (middleUp || ringUp || pinkyUp) && !(indexUp && middleUp && ringUp && pinkyUp)) return 'point';
  return 'none';
}

/** 2-D One Euro filter. */
class Euro2D {
  private px = 0;
  private py = 0;
  private vx = 0;
  private vy = 0;
  private t = 0;
  private has = false;

  constructor(
    private readonly minCutoff: number,
    private readonly beta: number,
    private readonly dCutoff = 1.5,
  ) {}

  reset(): void {
    this.has = false;
  }

  /** Smoothed speed in screen fractions per second. */
  speed(): { x: number; y: number } {
    return { x: this.vx, y: this.vy };
  }

  apply(t: number, x: number, y: number): { x: number; y: number } {
    if (!this.has || t <= this.t || t - this.t > 500) {
      this.has = true;
      this.px = x;
      this.py = y;
      this.vx = 0;
      this.vy = 0;
      this.t = t;
      return { x, y };
    }
    const dt = Math.max(0.001, (t - this.t) / 1000);
    const alpha = (cutoff: number): number => 1 / (1 + 1 / (2 * Math.PI * cutoff) / dt);
    const aD = alpha(this.dCutoff);
    this.vx += aD * ((x - this.px) / dt - this.vx);
    this.vy += aD * ((y - this.py) / dt - this.vy);
    const a = alpha(this.minCutoff + this.beta * Math.hypot(this.vx, this.vy));
    this.px += a * (x - this.px);
    this.py += a * (y - this.py);
    this.t = t;
    return { x: this.px, y: this.py };
  }
}

interface Sample {
  t: number;
  x: number;
  y: number;
  /** Smoothed palm centre (screen units) at the same moment: it barely moves when fingers flex. */
  px: number;
  py: number;
}

export class AirCursorTracker {
  private cfg: CursorConfig;
  private filter = new Euro2D(1.6, 9, 4);
  private palmFilter = new Euro2D(1.2, 6, 3);
  private releaseFrames = 0;
  private history: Sample[] = [];
  private lastEligible = Number.NEGATIVE_INFINITY;
  private ratios: { t: number; r: number }[] = [];
  private frozen: { x: number; y: number; px: number; py: number; since: number } | null = null;
  private pressed = false;
  private dragAnchor: { px: number; py: number; x: number; y: number } | null = null;
  private lastRawY: number | null = null;
  private state: CursorState = HIDDEN_CURSOR;
  private last: { x: number; y: number } = { x: 0.5, y: 0.5 };

  constructor(config: Partial<CursorConfig> = {}) {
    this.cfg = { ...DEFAULT_CURSOR_CONFIG, ...config };
  }

  setConfig(patch: Partial<CursorConfig>): void {
    this.cfg = { ...this.cfg, ...patch };
  }

  getState(): CursorState {
    return this.state;
  }

  /** Call when the hand disappears or the camera stops. Returns an 'up' if a press was in progress. */
  lost(): CursorEvent[] {
    const events: CursorEvent[] = this.pressed ? ['up'] : [];
    this.pressed = false;
    this.frozen = null;
    this.dragAnchor = null;
    this.lastRawY = null;
    this.history = [];
    this.filter.reset();
    this.palmFilter.reset();
    this.releaseFrames = 0;
    this.state = HIDDEN_CURSOR;
    return events;
  }

  /** Map a camera-frame point to the screen (0..1), using the central part of the frame. */
  private toScreen(px: number, py: number): { x: number; y: number } {
    const { marginX, marginY, mirror } = this.cfg;
    const sx = clamp01((px - marginX) / (1 - 2 * marginX));
    return { x: mirror ? 1 - sx : sx, y: clamp01((py - marginY) / (1 - 2 * marginY)) };
  }

  /** What the cursor saw on the last frame, for the optional on-screen diagnostics. */
  debug(): { shape: HandShape; ratios: number[]; hinted: boolean } {
    return this.lastDebug;
  }
  private lastDebug: { shape: HandShape; ratios: number[]; hinted: boolean } = { shape: 'none', ratios: [], hinted: false };

  /** `hint`: the gesture recogniser already says the hand is pointing; trust it when the quick check says 'none'. */
  update(t: number, lm: Landmarks, hint = false): { state: CursorState; events: CursorEvent[] } {
    const events: CursorEvent[] = [];
    if (lm.length < 21) {
      return { state: this.state, events: this.lost() };
    }
    const { aspect } = this.cfg;

    const handSize = Math.max(1e-6, dist(lm[LM.WRIST], lm[LM.MIDDLE_MCP], aspect));
    const ratio = dist(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP], aspect) / handSize;
    const closing = clamp01((this.cfg.approachRatio - ratio) / (this.cfg.approachRatio - this.cfg.pressRatio));

    const quick = handShape(lm, aspect, this.cfg.approachRatio);
    const hinted = hint && quick === 'none';
    const shape: HandShape = hinted ? 'point' : quick;
    this.lastDebug = { shape, ratios: fingerRatios(lm, aspect).map((r) => Math.round(r * 100) / 100), hinted };
    const eligible = shape !== 'none' || this.pressed;
    if (eligible) this.lastEligible = t;
    if (!eligible && t - this.lastEligible > HIDE_GRACE_MS) {
      return { state: this.state.mode === 'hidden' ? this.state : this.hideState(events), events };
    }

    // Where the fingertip points right now (smoothed).
    const tip = lm[LM.INDEX_TIP];
    const target = this.toScreen(tip.x, tip.y);
    const smooth = this.filter.apply(t, target.x, target.y);
    const palmRaw = palmCenter(lm);
    const palmScreen = this.toScreen(palmRaw.x, palmRaw.y);
    const palm = this.palmFilter.apply(t, palmScreen.x, palmScreen.y);
    this.history.push({ t, x: smooth.x, y: smooth.y, px: palm.x, py: palm.y });
    this.history = this.history.filter((s) => t - s.t <= HISTORY_MS);

    let x = smooth.x;
    let y = smooth.y;

    if (this.pressed) {
      // Dragging: follow the (smoothed) palm relative to where the press began. Fingers flexing do not move it.
      this.releaseFrames = ratio > this.cfg.releaseRatio ? this.releaseFrames + 1 : 0;
      if (this.releaseFrames >= 2) {
        // Let go at the last steady spot, not where the opening fingers drifted to.
        this.pressed = false;
        this.dragAnchor = null;
        this.frozen = null;
        this.releaseFrames = 0;
        this.filter.reset();
        x = this.last.x;
        y = this.last.y;
        events.push('up');
      } else if (this.dragAnchor) {
        const an = this.dragAnchor;
        x = clamp01(an.x + (palm.x - an.px) * DRAG_GAIN);
        y = clamp01(an.y + (palm.y - an.py) * DRAG_GAIN);
        if (this.releaseFrames > 0) {
          x = this.last.x; // fingers are opening: hold still until it is clear whether this is a release
          y = this.last.y;
        }
      }
    } else {
      if (shape === 'two') {
        this.frozen = null; // scrolling: never keep a stale aim point from a half-closed pinch
      } else {
        // Freeze position when the hand starts closing for a click.
        this.ratios.push({ t, r: ratio });
        this.ratios = this.ratios.filter((q) => t - q.t <= CLOSE_WINDOW_MS);
        const oldest = this.ratios[0];
        const closingFast = !!oldest && oldest.r - ratio > CLOSE_RATE && ratio < CLOSE_MAX_RATIO;
        if (this.frozen === null && (ratio < this.cfg.approachRatio || closingFast)) {
          const back = this.history.find((s) => t - s.t <= FREEZE_LOOKBACK_MS) ?? this.history[0];
          this.frozen = { x: back.x, y: back.y, px: back.px, py: back.py, since: t };
        }
        if (this.frozen !== null) {
          if (ratio > Math.max(this.cfg.approachRatio + 0.1, CLOSE_MAX_RATIO + 0.15) || t - this.frozen.since > FREEZE_TIMEOUT_MS) {
            this.frozen = null; // changed their mind
          } else {
            // Aim stays where the finger was, but follows the hand if the whole hand moves.
            x = clamp01(this.frozen.x + (palm.x - this.frozen.px));
            y = clamp01(this.frozen.y + (palm.y - this.frozen.py));
            if (ratio < this.cfg.pressRatio) {
              this.pressed = true;
              this.releaseFrames = 0;
              this.dragAnchor = { px: palm.x, py: palm.y, x, y };
              events.push('down');
            }
          }
        }
      }
    }

    // Two-finger scroll: report vertical fingertip movement.
    let scrollDy = 0;
    const scrolling = shape === 'two' && !this.pressed;
    if (scrolling) {
      if (this.lastRawY !== null) scrollDy = smooth.y - this.lastRawY;
      this.lastRawY = smooth.y;
    } else {
      this.lastRawY = null;
    }

    if (!this.pressed && !this.frozen) {
      const v = this.filter.speed();
      const speed = Math.hypot(v.x, v.y);
      const k = clamp01((speed - LEAD_FROM_SPEED) / (LEAD_FULL_SPEED - LEAD_FROM_SPEED));
      x = clamp01(x + v.x * LEAD_S * k);
      y = clamp01(y + v.y * LEAD_S * k);
    }

    this.last = { x, y };
    const mode: CursorMode = this.pressed ? 'pressed' : scrolling ? 'scroll' : 'point';
    this.state = { mode, x, y, closing: this.pressed ? 1 : closing, scrollDy };
    return { state: this.state, events };
  }

  private hideState(events: CursorEvent[]): CursorState {
    events.push(...this.lost());
    return this.state;
  }

  /** Last position, used by overlays that keep the final spot visible briefly. */
  lastPosition(): { x: number; y: number } {
    return this.last;
  }
}
