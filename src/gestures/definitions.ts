// Gesture and action catalogue. This is DATA, not logic: the mapping between
// them is stored in settings, so assignments can change without touching code.
// Phase 2 (Gesture Lab) will add the camera + MediaPipe recognizer that emits these gesture ids.

export type GestureKind = 'pose' | 'movement';

export interface GestureDef {
  id: string;
  label: string;
  kind: GestureKind;
  help: string;
}

export const GESTURES = [
  { id: 'open-palm', label: 'Open palm', kind: 'pose', help: 'All fingers extended, palm facing the camera.' },
  { id: 'closed-fist', label: 'Closed fist', kind: 'pose', help: 'All fingers curled into a fist.' },
  { id: 'pointing', label: 'Pointing', kind: 'pose', help: 'Index finger extended, other fingers curled.' },
  { id: 'two-finger', label: 'Two fingers', kind: 'pose', help: 'Index and middle fingers extended.' },
  { id: 'pinch', label: 'Pinch', kind: 'pose', help: 'Thumb tip and index tip touching.' },
  { id: 'swipe-right', label: 'Swipe right', kind: 'movement', help: 'Move your open hand quickly to the right.' },
  { id: 'swipe-left', label: 'Swipe left', kind: 'movement', help: 'Move your open hand quickly to the left.' },
  { id: 'swipe-up', label: 'Swipe up', kind: 'movement', help: 'Move your open hand quickly upward.' },
  { id: 'swipe-down', label: 'Swipe down', kind: 'movement', help: 'Move your open hand quickly downward.' },
  { id: 'pinch-release', label: 'Pinch and release', kind: 'movement', help: 'Pinch, then open your fingers again.' },
] as const satisfies readonly GestureDef[];

export type GestureId = (typeof GESTURES)[number]['id'];

export interface ActionDef {
  id: string;
  label: string;
  description: string;
}

export const ACTIONS = [
  { id: 'next-panel', label: 'Next panel', description: 'Go to the next section or card.' },
  { id: 'previous-panel', label: 'Previous panel', description: 'Go to the previous section or card.' },
  { id: 'select', label: 'Select', description: 'Choose the highlighted item.' },
  { id: 'back', label: 'Back / cancel', description: 'Go back or close the current panel.' },
  { id: 'pause', label: 'Pause gestures', description: 'Pause or resume gesture recognition.' },
  { id: 'scroll-up', label: 'Scroll up', description: 'Move up through vertical content.' },
  { id: 'scroll-down', label: 'Scroll down', description: 'Move down through vertical content.' },
  { id: 'zoom', label: 'Zoom', description: 'Zoom in the current view (for example the globe).' },
] as const satisfies readonly ActionDef[];

export type ActionId = (typeof ACTIONS)[number]['id'];

export type GestureMappings = Record<ActionId, GestureId | null>;

export const DEFAULT_MAPPINGS: GestureMappings = {
  'next-panel': 'swipe-right',
  'previous-panel': 'swipe-left',
  select: 'pinch',
  back: 'closed-fist',
  pause: 'open-palm',
  'scroll-up': 'swipe-up',
  'scroll-down': 'swipe-down',
  zoom: 'pinch-release',
};

const GESTURE_IDS: ReadonlySet<string> = new Set(GESTURES.map((g) => g.id));

export function isGestureId(value: unknown): value is GestureId {
  return typeof value === 'string' && GESTURE_IDS.has(value);
}

export function getGesture(id: GestureId): GestureDef {
  return GESTURES.find((g) => g.id === id) as GestureDef;
}

/**
 * Assign a gesture to an action. A gesture can only trigger one action, so if it was
 * already used elsewhere, that other action becomes unassigned (null).
 * Returns a new object; never mutates the input.
 */
export function assignGesture(
  mappings: GestureMappings,
  action: ActionId,
  gesture: GestureId | null,
): GestureMappings {
  const next: GestureMappings = { ...mappings };
  if (gesture !== null) {
    for (const a of ACTIONS) {
      if (a.id !== action && next[a.id] === gesture) next[a.id] = null;
    }
  }
  next[action] = gesture;
  return next;
}

/** How quickly gestures react. Scales hold times, cooldowns and the pause between actions. */
export type GestureSpeed = 'calm' | 'balanced' | 'quick' | 'instant';

export const GESTURE_SPEEDS: ReadonlyArray<{ id: GestureSpeed; label: string; hint: string; factor: number }> = [
  { id: 'calm', label: 'Calm', hint: 'Slowest, fewest accidents', factor: 1 },
  { id: 'balanced', label: 'Balanced', hint: 'A bit quicker', factor: 0.6 },
  { id: 'quick', label: 'Quick', hint: 'Fast and still safe', factor: 0.32 },
  { id: 'instant', label: 'Instant', hint: 'Fastest; may trigger by accident', factor: 0.16 },
];

export const DEFAULT_GESTURE_SPEED: GestureSpeed = 'quick';

export function isGestureSpeed(v: unknown): v is GestureSpeed {
  return GESTURE_SPEEDS.some((s) => s.id === v);
}

export function speedFactor(speed: GestureSpeed): number {
  return GESTURE_SPEEDS.find((s) => s.id === speed)?.factor ?? 0.32;
}
