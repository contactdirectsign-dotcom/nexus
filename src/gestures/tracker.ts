import type { GestureId } from './definitions';
import { palmCenter, type Landmarks } from './landmarks';
import { LandmarkSmoother } from './smoothing';
import { classifyPose, type PoseId } from './recognizer';

/**
 * GestureTracker turns a stream of hand frames into discrete gesture EVENTS.
 * It is pure (no camera, no DOM, no timers): you feed it frames with timestamps.
 * That makes it testable and keeps all the "don't trigger by accident" rules in one place:
 *
 *  - Poses must be HELD still for a while (dwell time) before they fire.
 *  - A pose fires once, then must change (or the hand must leave) before it can fire again.
 *  - Swipes are detected from movement over time, never from a static pose.
 *  - After any event there is a cooldown, and the "return" motion of a swipe is ignored.
 *  - Pose changes need 2 consecutive frames (debounce) so one noisy frame does nothing.
 */

export type HandPreference = 'right' | 'left' | 'either' | 'both';

export interface HandFrame {
  landmarks: Landmarks;
  /** MediaPipe's label for the image as given (see userHandFromLabel). */
  label?: 'Left' | 'Right';
  score: number;
}

export interface GestureEvent {
  gesture: GestureId;
  confidence: number;
  t: number;
}

export interface TrackerState {
  handDetected: boolean;
  pose: PoseId;
  confidence: number;
  /** 0..1 progress of the dwell timer for the current pose. */
  holdProgress: number;
  userHand: 'left' | 'right' | null;
  detectScore: number;
}

export interface TrackerConfig {
  /** 0 (strict) .. 1 (sensitive). */
  sensitivity: number;
  hand: HandPreference;
  /** Video width / height. */
  aspect: number;
  /** True for a front camera shown as a mirror. Makes "swipe right" mean the user's right. */
  mirror: boolean;
}

/** How long each pose must be held before it fires (ms, at sensitivity 0.5). */
export const POSE_HOLD_MS = {
  'open-palm': 1200, // long on purpose: an open hand is also how you start a swipe
  'closed-fist': 900,
  pointing: 600,
  'two-finger': 600,
  pinch: 450,
} as const;

const LOST_MS = 300;
const SWIPE_WINDOW_MS = 500;
const MIN_SWIPE_MS = 150;
const MIN_SWIPE_SPEED = 0.3; // frame-widths per second (calm, deliberate swipes count)
const COOLDOWN_MS = 1000;
const OPPOSITE_BLOCK_MS = 1500;
const PINCH_TAP_MIN_MS = 80;
const STILL_WINDOW_MS = 250;
const STILL_MAX_MOVE = 0.06;
const POSE_SWITCH_FRAMES = 3;

type SwipeId = 'swipe-left' | 'swipe-right' | 'swipe-up' | 'swipe-down';
const OPPOSITE: Record<SwipeId, SwipeId> = {
  'swipe-left': 'swipe-right',
  'swipe-right': 'swipe-left',
  'swipe-up': 'swipe-down',
  'swipe-down': 'swipe-up',
};

interface Sample {
  t: number;
  x: number;
  y: number;
}

/**
 * MediaPipe assumes a mirrored (selfie) image when it labels Left/Right. We feed it the raw,
 * un-mirrored camera frame, so its label is the opposite of the user's real hand.
 */
export function userHandFromLabel(label: 'Left' | 'Right' | undefined): 'left' | 'right' | null {
  if (label === 'Left') return 'right';
  if (label === 'Right') return 'left';
  return null;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export const IDLE_STATE: TrackerState = {
  handDetected: false,
  pose: 'none',
  confidence: 0,
  holdProgress: 0,
  userHand: null,
  detectScore: 0,
};

export class GestureTracker {
  private cfg: TrackerConfig;
  private state: TrackerState = IDLE_STATE;

  private candidate: PoseId = 'none';
  private candidateConf = 0;
  private candidateSince = 0; // when this pose became stable (used to time pinch taps)
  private holdSince = 0; // when the hold timer started (restarts if the hand moves)
  private fired = false;
  private pending: PoseId | null = null;
  private pendingCount = 0;

  private samples: Sample[] = [];
  private smoother = new LandmarkSmoother();
  private lastSeen = Number.NEGATIVE_INFINITY;
  private cooldownUntil = 0;
  private lastSwipe: { gesture: SwipeId; t: number } | null = null;

  constructor(config: Partial<TrackerConfig> = {}) {
    this.cfg = { sensitivity: 0.5, hand: 'either', aspect: 1, mirror: true, ...config };
  }

  setConfig(patch: Partial<TrackerConfig>): void {
    this.cfg = { ...this.cfg, ...patch };
  }

  getState(): TrackerState {
    return this.state;
  }

  reset(): void {
    this.clearTracking();
    this.cooldownUntil = 0;
    this.state = IDLE_STATE;
  }

  /** Feed one camera frame. Returns the gesture events (usually none) that happened in it. */
  update(t: number, hands: readonly HandFrame[]): GestureEvent[] {
    const events: GestureEvent[] = [];
    const hand = this.pickHand(hands);

    if (!hand) {
      if (t - this.lastSeen > LOST_MS) this.clearTracking();
      this.state = IDLE_STATE;
      return events;
    }
    this.lastSeen = t;

    const sens = this.cfg.sensitivity;
    const landmarks = this.smoother.apply(t, hand.landmarks);
    const { pose: rawPose, confidence } = classifyPose(landmarks, {
      aspect: this.cfg.aspect,
      sensitivity: sens,
    });
    const minConfidence = 0.5 - 0.3 * sens;
    const observed: PoseId = confidence >= minConfidence ? rawPose : 'none';

    // Movement history of the palm centre
    const c = palmCenter(landmarks);
    this.samples.push({ t, x: this.cfg.mirror ? 1 - c.x : c.x, y: c.y });
    this.samples = this.samples.filter((s) => t - s.t <= 800);

    // Debounce: a new pose must be seen in consecutive frames before we believe it.
    if (observed === this.candidate) {
      this.pending = null;
      this.pendingCount = 0;
      this.candidateConf = confidence;
    } else {
      if (observed === this.pending) this.pendingCount += 1;
      else {
        this.pending = observed;
        this.pendingCount = 1;
      }
      if (this.pendingCount >= POSE_SWITCH_FRAMES) this.switchPose(observed, confidence, t, events);
    }

    // Swipe: movement over time, only with an open hand, outside cooldown.
    if (this.candidate === 'open-palm' && t >= this.cooldownUntil) {
      const swipe = this.detectSwipe(t);
      if (swipe) {
        const blocked =
          this.lastSwipe !== null &&
          t - this.lastSwipe.t < OPPOSITE_BLOCK_MS &&
          this.lastSwipe.gesture === OPPOSITE[swipe];
        if (!blocked) {
          events.push({ gesture: swipe, confidence: this.candidateConf, t });
          this.lastSwipe = { gesture: swipe, t };
        }
        this.samples = [];
        this.cooldownUntil = t + COOLDOWN_MS;
        this.fired = true; // a swipe must not also count as an "open palm" press
        this.holdSince = t;
      }
    }

    // Hold timer for static poses. It only runs while the hand is still.
    let holdProgress = 0;
    const pose = this.candidate;
    if (pose !== 'none') {
      if (!this.isStill(t)) this.holdSince = t;
      if (this.fired) {
        holdProgress = 1;
      } else {
        const holdMs = POSE_HOLD_MS[pose] * (1.5 - sens);
        holdProgress = clamp01((t - this.holdSince) / holdMs);
        if (holdProgress >= 1 && t >= this.cooldownUntil) {
          events.push({ gesture: pose, confidence: this.candidateConf, t });
          this.fired = true;
          this.cooldownUntil = t + COOLDOWN_MS;
        }
      }
    }

    this.state = {
      handDetected: true,
      pose: this.candidate,
      confidence: this.candidateConf,
      holdProgress,
      userHand: userHandFromLabel(hand.label),
      detectScore: hand.score,
    };
    return events;
  }

  private switchPose(next: PoseId, conf: number, t: number, events: GestureEvent[]): void {
    // A quick pinch-and-release (shorter than the pinch dwell time) is its own gesture.
    if (this.candidate === 'pinch' && !this.fired) {
      const duration = t - this.candidateSince;
      if (duration >= PINCH_TAP_MIN_MS && t >= this.cooldownUntil) {
        events.push({ gesture: 'pinch-release', confidence: this.candidateConf, t });
        this.cooldownUntil = t + COOLDOWN_MS;
      }
    }
    this.candidate = next;
    this.candidateConf = conf;
    this.candidateSince = t;
    this.holdSince = t;
    this.fired = false;
    this.pending = null;
    this.pendingCount = 0;
  }

  private detectSwipe(t: number): SwipeId | null {
    const win = this.samples.filter((s) => t - s.t <= SWIPE_WINDOW_MS);
    if (win.length < 3) return null;
    const first = win[0];
    const last = win[win.length - 1];
    const dt = last.t - first.t;
    if (dt < MIN_SWIPE_MS) return null;
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    if (Math.hypot(dx, dy) / (dt / 1000) < MIN_SWIPE_SPEED) return null;

    const distance = 0.3 - 0.16 * this.cfg.sensitivity; // fraction of frame width
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax >= distance && ax > 1.8 * ay) return dx > 0 ? 'swipe-right' : 'swipe-left';
    if (ay >= distance * 0.8 && ay > 1.8 * ax) return dy > 0 ? 'swipe-down' : 'swipe-up';
    return null;
  }

  private isStill(t: number): boolean {
    const win = this.samples.filter((s) => t - s.t <= STILL_WINDOW_MS);
    if (win.length < 2) return true;
    const a = win[0];
    const b = win[win.length - 1];
    return Math.hypot(b.x - a.x, b.y - a.y) < STILL_MAX_MOVE;
  }

  private pickHand(hands: readonly HandFrame[]): HandFrame | null {
    const wanted = this.cfg.hand;
    let best: HandFrame | null = null;
    for (const h of hands) {
      const side = userHandFromLabel(h.label);
      if ((wanted === 'right' || wanted === 'left') && side !== null && side !== wanted) continue;
      if (!best || h.score > best.score) best = h;
    }
    return best;
  }

  private clearTracking(): void {
    this.candidate = 'none';
    this.candidateConf = 0;
    this.fired = false;
    this.pending = null;
    this.pendingCount = 0;
    this.samples = [];
    this.lastSwipe = null;
    this.smoother.reset();
  }
}
