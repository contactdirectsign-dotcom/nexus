import { describe, expect, it } from 'vitest';
import { frames, names, run } from '../test/hands';
import { GestureTracker, userHandFromLabel } from './tracker';

const OPEN = {};
const FIST = { index: false, middle: false, ring: false, pinky: false };

describe('static poses', () => {
  it('fires an open palm once after the dwell time, not continuously', () => {
    const t = new GestureTracker();
    const events = run(t, frames(0, 3000, () => OPEN));
    expect(names(events)).toEqual(['open-palm']);
  });

  it('does not fire before the dwell time', () => {
    const t = new GestureTracker();
    const events = run(t, frames(0, 600, () => OPEN));
    expect(events).toHaveLength(0);
  });

  it('fires a closed fist once', () => {
    const t = new GestureTracker();
    expect(names(run(t, frames(0, 2500, () => FIST)))).toEqual(['closed-fist']);
  });

  it('can fire again after the hand leaves and returns', () => {
    const t = new GestureTracker();
    const first = run(t, frames(0, 1200, () => FIST));
    const gap = run(t, frames(1250, 1900, () => null));
    const second = run(t, frames(1950, 3200, () => FIST));
    expect(names(first)).toEqual(['closed-fist']);
    expect(gap).toHaveLength(0);
    expect(names(second)).toEqual(['closed-fist']);
  });

  it('reports hold progress and clears state when the hand is lost', () => {
    const t = new GestureTracker();
    run(t, frames(0, 500, () => FIST));
    expect(t.getState().handDetected).toBe(true);
    expect(t.getState().pose).toBe('closed-fist');
    expect(t.getState().holdProgress).toBeGreaterThan(0.3);
    run(t, [{ t: 600, hand: null }]);
    expect(t.getState().handDetected).toBe(false);
  });

  it('ignores a single noisy frame (debounce)', () => {
    const t = new GestureTracker();
    const list = frames(0, 2000, () => OPEN);
    list[10] = { t: list[10].t, hand: FIST }; // one bad frame
    expect(names(run(t, list))).toEqual(['open-palm']);
  });
});

describe('swipes use movement over time', () => {
  it('a still open hand never produces a swipe', () => {
    const t = new GestureTracker();
    const events = run(t, frames(0, 4000, () => OPEN));
    expect(names(events).filter((n) => n.startsWith('swipe'))).toHaveLength(0);
  });

  it("detects a swipe to the user's right once (raw x decreases on a front camera)", () => {
    const t = new GestureTracker();
    const events = run(
      t,
      frames(0, 600, (ms) => ({ dx: 0.2 - Math.min(ms, 300) * (0.4 / 300) })),
    );
    expect(names(events)).toEqual(['swipe-right']);
  });

  it('detects a swipe left', () => {
    const t = new GestureTracker();
    const events = run(
      t,
      frames(0, 600, (ms) => ({ dx: -0.2 + Math.min(ms, 300) * (0.4 / 300) })),
    );
    expect(names(events)).toEqual(['swipe-left']);
  });

  it('detects vertical swipes', () => {
    const up = new GestureTracker();
    const upEvents = run(
      up,
      frames(0, 600, (ms) => ({ dy: 0.2 - Math.min(ms, 300) * (0.4 / 300) })),
    );
    expect(names(upEvents)).toEqual(['swipe-up']);
  });

  it('ignores the hand returning after a swipe (opposite direction)', () => {
    const t = new GestureTracker();
    const swipe = frames(0, 400, (ms) => ({ dx: 0.2 - Math.min(ms, 300) * (0.4 / 300) }));
    // hand held still, then moved back to the start position
    const hold = frames(450, 900, () => ({ dx: -0.2 }));
    const back = frames(950, 1250, (ms) => ({ dx: -0.2 + ((ms - 950) * 0.4) / 300 }));
    const events = run(t, [...swipe, ...hold, ...back]);
    expect(names(events)).toEqual(['swipe-right']);
  });

  it('a slow drift is not a swipe', () => {
    const t = new GestureTracker();
    const events = run(
      t,
      frames(0, 3000, (ms) => ({ dx: -0.2 + (ms / 3000) * 0.4 })),
    );
    expect(names(events).filter((n) => n.startsWith('swipe'))).toHaveLength(0);
  });

  it('a swipe does not also fire an open-palm press', () => {
    const t = new GestureTracker();
    const events = run(
      t,
      frames(0, 1500, (ms) => ({ dx: 0.2 - Math.min(ms, 300) * (0.4 / 300) })),
    );
    expect(names(events)).not.toContain('open-palm');
  });
});

describe('pinch', () => {
  it('a held pinch fires "pinch" once and not "pinch-release"', () => {
    const t = new GestureTracker();
    const events = run(t, [
      ...frames(0, 250, () => OPEN),
      ...frames(300, 1000, () => ({ pinch: true })),
      ...frames(1050, 1300, () => OPEN),
    ]);
    expect(names(events)).toEqual(['pinch']);
  });

  it('a quick pinch and release fires "pinch-release"', () => {
    const t = new GestureTracker();
    const events = run(t, [
      ...frames(0, 250, () => OPEN),
      ...frames(300, 500, () => ({ pinch: true })),
      ...frames(550, 800, () => OPEN),
    ]);
    expect(names(events)).toEqual(['pinch-release']);
  });
});

describe('hand preference', () => {
  it('maps MediaPipe labels to the real hand (un-mirrored camera frame)', () => {
    expect(userHandFromLabel('Left')).toBe('right');
    expect(userHandFromLabel('Right')).toBe('left');
    expect(userHandFromLabel(undefined)).toBeNull();
  });

  it('ignores the non-preferred hand', () => {
    const t = new GestureTracker({ hand: 'right' });
    // label "Right" = the user's LEFT hand
    const events = run(
      t,
      frames(0, 2000, () => FIST).map((f) => ({ ...f, label: 'Right' as const })),
    );
    expect(events).toHaveLength(0);
    expect(t.getState().handDetected).toBe(false);
  });

  it('accepts the preferred hand', () => {
    const t = new GestureTracker({ hand: 'right' });
    const events = run(
      t,
      frames(0, 2000, () => FIST).map((f) => ({ ...f, label: 'Left' as const })),
    );
    expect(names(events)).toEqual(['closed-fist']);
  });
});

describe('sensitivity', () => {
  it('higher sensitivity fires poses sooner', () => {
    const strict = new GestureTracker({ sensitivity: 0 });
    const eager = new GestureTracker({ sensitivity: 1 });
    const list = frames(0, 700, () => FIST);
    expect(run(strict, list)).toHaveLength(0);
    expect(names(run(eager, list))).toEqual(['closed-fist']);
  });
});
