import { describe, expect, it } from 'vitest';
import { makeHand } from '../test/hands';
import { classifyPose } from './recognizer';

describe('classifyPose (synthetic hands)', () => {
  it('recognises an open palm', () => {
    expect(classifyPose(makeHand()).pose).toBe('open-palm');
  });

  it('recognises a closed fist', () => {
    const r = classifyPose(makeHand({ index: false, middle: false, ring: false, pinky: false }));
    expect(r.pose).toBe('closed-fist');
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it('recognises pointing (index only)', () => {
    expect(classifyPose(makeHand({ middle: false, ring: false, pinky: false })).pose).toBe('pointing');
  });

  it('recognises two fingers (index + middle)', () => {
    expect(classifyPose(makeHand({ ring: false, pinky: false })).pose).toBe('two-finger');
  });

  it('recognises a pinch', () => {
    expect(classifyPose(makeHand({ pinch: true })).pose).toBe('pinch');
  });

  it('does not call a fist a pinch', () => {
    const fist = makeHand({ index: false, middle: false, ring: false, pinky: false, pinch: true });
    expect(classifyPose(fist).pose).toBe('closed-fist');
  });

  it('returns none for odd shapes (ring finger only)', () => {
    expect(classifyPose(makeHand({ index: false, middle: false, pinky: false })).pose).toBe('none');
  });

  it('is independent of where the hand is in the frame', () => {
    expect(classifyPose(makeHand({ dx: -0.2, dy: -0.3 })).pose).toBe('open-palm');
  });

  it('handles incomplete data safely', () => {
    expect(classifyPose([]).pose).toBe('none');
  });
});
