// MediaPipe hand landmarks: 21 points per hand, x/y normalised to 0..1 of the video frame.

export interface Point {
  x: number;
  y: number;
  z?: number;
}

export type Landmarks = readonly Point[];

export const LM = {
  WRIST: 0,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_TIP: 20,
} as const;

/**
 * Distance between two points. `aspect` is video width / height: x and y are normalised
 * separately, so without this correction distances would be stretched on a 4:3 frame.
 */
export function dist(a: Point, b: Point, aspect = 1): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

/** Centre of the palm (average of the wrist and the four finger bases). */
export function palmCenter(lm: Landmarks): Point {
  const ids = [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP];
  let x = 0;
  let y = 0;
  for (const i of ids) {
    x += lm[i].x;
    y += lm[i].y;
  }
  return { x: x / ids.length, y: y / ids.length };
}

/** Lines used to draw the hand skeleton on the calibration preview. */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
