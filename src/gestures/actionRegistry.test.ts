import { describe, expect, it, vi } from 'vitest';
import { registerActionHandler, runAction } from './actionRegistry';

describe('action registry', () => {
  it('returns false when nothing handles the action', () => {
    expect(runAction('zoom')).toBe(false);
  });

  it('runs the most recently registered handler first', () => {
    const base = vi.fn();
    const top = vi.fn();
    const offBase = registerActionHandler('next-panel', base);
    const offTop = registerActionHandler('next-panel', top);
    expect(runAction('next-panel')).toBe(true);
    expect(top).toHaveBeenCalledTimes(1);
    expect(base).not.toHaveBeenCalled();
    offTop();
    offBase();
  });

  it('falls through when a handler returns false', () => {
    const base = vi.fn();
    const top = vi.fn(() => false);
    const offBase = registerActionHandler('back', base);
    const offTop = registerActionHandler('back', top);
    expect(runAction('back')).toBe(true);
    expect(top).toHaveBeenCalled();
    expect(base).toHaveBeenCalled();
    offTop();
    offBase();
  });

  it('stops handling after unregistering', () => {
    const h = vi.fn();
    const off = registerActionHandler('select', h);
    off();
    expect(runAction('select')).toBe(false);
    expect(h).not.toHaveBeenCalled();
  });
});
