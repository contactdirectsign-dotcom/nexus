import { LM, dist, type Landmarks } from './landmarks';

export type PoseId = 'open-palm' | 'closed-fist' | 'pointing' | 'two-finger' | 'pinch' | 'none';

export interface PoseResult {
  pose: PoseId;
  /** 0..1 heuristic certainty (geometry margin), NOT a trained-model probability. */
  confidence: number;
}

interface FingerJoints {
  pip: number;
  tip: number;
}

// Index, middle, ring, pinky. The thumb is handled separately (pinch only).
const FINGERS: readonly FingerJoints[] = [
  { pip: LM.INDEX_PIP, tip: LM.INDEX_TIP },
  { pip: LM.MIDDLE_PIP, tip: LM.MIDDLE_TIP },
  { pip: LM.RING_PIP, tip: LM.RING_TIP },
  { pip: LM.PINKY_PIP, tip: LM.PINKY_TIP },
];

/**
 * A finger is "extended" when its tip is farther from the wrist than its middle joint.
 * Ratio is about 1.3 for a straight finger and 0.7 for a curled one, so 1.0 separates them.
 * Using distances (not "is the tip above the joint") makes it work at any hand rotation.
 */
const EXTENDED_RATIO = 1.0;
const CERTAINTY_SPAN = 0.3;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export interface ClassifyOptions {
  /** Video width / height. */
  aspect?: number;
  /** 0..1. Higher accepts looser pinches. */
  sensitivity?: number;
}

/** Classify a single frame's hand shape. Pure function: no state, no camera. */
export function classifyPose(lm: Landmarks, opts: ClassifyOptions = {}): PoseResult {
  if (lm.length < 21) return { pose: 'none', confidence: 0 };
  const aspect = opts.aspect ?? 1;
  const sensitivity = opts.sensitivity ?? 0.5;

  const ratios = FINGERS.map(
    (f) => dist(lm[f.tip], lm[LM.WRIST], aspect) / Math.max(1e-6, dist(lm[f.pip], lm[LM.WRIST], aspect)),
  );
  const extended = ratios.map((r) => r > EXTENDED_RATIO);
  const certainty = ratios.map((r) => clamp01(Math.abs(r - EXTENDED_RATIO) / CERTAINTY_SPAN));
  const meanCertainty = (ids: number[]): number => ids.reduce((sum, i) => sum + certainty[i], 0) / ids.length;

  // Pinch: thumb tip and index tip touching, relative to palm size so it works at any distance.
  // At least one of middle/ring/pinky must be extended, otherwise a loose fist would count as a pinch.
  const handSize = Math.max(1e-6, dist(lm[LM.WRIST], lm[LM.MIDDLE_MCP], aspect));
  const pinchRatio = dist(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP], aspect) / handSize;
  const pinchThreshold = 0.25 + 0.15 * sensitivity;
  const otherFingersExtended = [1, 2, 3].filter((i) => extended[i]).length;
  if (pinchRatio < pinchThreshold && otherFingersExtended >= 1) {
    return { pose: 'pinch', confidence: clamp01(1 - (0.5 * pinchRatio) / pinchThreshold) };
  }

  const count = extended.filter(Boolean).length;
  if (count === 0) return { pose: 'closed-fist', confidence: meanCertainty([0, 1, 2, 3]) };
  if (count === 4) return { pose: 'open-palm', confidence: meanCertainty([0, 1, 2, 3]) };
  if (extended[0] && !extended[1] && !extended[2] && !extended[3]) {
    return { pose: 'pointing', confidence: meanCertainty([0, 1, 2, 3]) };
  }
  if (extended[0] && extended[1] && !extended[2] && !extended[3]) {
    return { pose: 'two-finger', confidence: meanCertainty([0, 1, 2, 3]) };
  }
  return { pose: 'none', confidence: 0 };
}
