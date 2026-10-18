import { describe, expect, it } from 'vitest';
import { ACTIONS, DEFAULT_MAPPINGS, GESTURES, assignGesture, isGestureId } from './definitions';

describe('gesture catalogue', () => {
  it('has unique gesture ids', () => {
    const ids = GESTURES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('default mappings cover every action with a valid, unique gesture', () => {
    const used = new Set<string>();
    for (const a of ACTIONS) {
      const g = DEFAULT_MAPPINGS[a.id];
      expect(g).not.toBeNull();
      expect(isGestureId(g)).toBe(true);
      expect(used.has(g as string)).toBe(false);
      used.add(g as string);
    }
  });

  it('rejects unknown gesture ids', () => {
    expect(isGestureId('wave')).toBe(false);
    expect(isGestureId(42)).toBe(false);
  });
});

describe('assignGesture', () => {
  it('assigns a gesture and does not mutate the input', () => {
    const before = { ...DEFAULT_MAPPINGS };
    const next = assignGesture(DEFAULT_MAPPINGS, 'select', 'pointing');
    expect(next.select).toBe('pointing');
    expect(DEFAULT_MAPPINGS).toEqual(before);
  });

  it('moves a gesture away from the action that used it', () => {
    // swipe-right belongs to next-panel by default
    const next = assignGesture(DEFAULT_MAPPINGS, 'select', 'swipe-right');
    expect(next.select).toBe('swipe-right');
    expect(next['next-panel']).toBeNull();
  });

  it('can disable an action', () => {
    const next = assignGesture(DEFAULT_MAPPINGS, 'back', null);
    expect(next.back).toBeNull();
  });
});
