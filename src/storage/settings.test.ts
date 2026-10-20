import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  eraseAllLocalData,
  getSettings,
  reloadSettings,
  resetSettings,
  sanitizeSettings,
  updateSettings,
} from './settings';

beforeEach(() => {
  window.localStorage.clear();
  resetSettings();
});

describe('sanitizeSettings', () => {
  it('returns defaults for garbage input', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(123)).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps sensitivity into 0..1', () => {
    expect(sanitizeSettings({ sensitivity: 5 }).sensitivity).toBe(1);
    expect(sanitizeSettings({ sensitivity: -3 }).sensitivity).toBe(0);
    expect(sanitizeSettings({ sensitivity: Number.NaN }).sensitivity).toBe(DEFAULT_SETTINGS.sensitivity);
  });

  it('ignores invalid values field by field', () => {
    const s = sanitizeSettings({ hand: 'foot', timeFormat: '12h', reducedEffects: 'yes' });
    expect(s.hand).toBe(DEFAULT_SETTINGS.hand);
    expect(s.timeFormat).toBe('12h');
    expect(s.reducedEffects).toBe(false);
  });

  it('drops unknown gestures and duplicate assignments from stored mappings', () => {
    const s = sanitizeSettings({
      mappings: { select: 'wave', back: 'pinch', zoom: 'pinch', pause: null },
    });
    expect(s.mappings.back).toBe('pinch');
    // select: 'wave' is invalid and its default (pinch) is now taken -> left unassigned
    expect(s.mappings.select).toBeNull();
    // zoom: duplicate 'pinch' is rejected -> falls back to its free default
    expect(s.mappings.zoom).toBe(DEFAULT_SETTINGS.mappings.zoom);
    expect(s.mappings.pause).toBeNull(); // explicit disable is kept
  });

  it('validates the hand camera setting', () => {
    expect(sanitizeSettings({ showHandCam: false }).showHandCam).toBe(false);
    expect(sanitizeSettings({ showHandCam: 'no' }).showHandCam).toBe(true);
  });

  it('never produces two actions with the same gesture', () => {
    const s = sanitizeSettings({ mappings: { select: 'swipe-right', back: 'swipe-right' } });
    const assigned = Object.values(s.mappings).filter((g) => g !== null);
    expect(new Set(assigned).size).toBe(assigned.length);
  });
});

describe('settings store', () => {
  it('updates and persists to localStorage', () => {
    updateSettings({ timeFormat: '12h', hand: 'left' });
    expect(getSettings().timeFormat).toBe('12h');
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.hand).toBe('left');
  });

  it('survives a reload from storage', () => {
    updateSettings({ sensitivity: 0.8 });
    reloadSettings();
    expect(getSettings().sensitivity).toBeCloseTo(0.8);
  });

  it('recovers from corrupted storage', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    reloadSettings();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('resets to defaults', () => {
    updateSettings({ hand: 'right', reducedEffects: true });
    resetSettings();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('erases only nexus.* keys', () => {
    window.localStorage.setItem('other.app', 'keep');
    updateSettings({ hand: 'right' });
    eraseAllLocalData();
    expect(window.localStorage.getItem('other.app')).toBe('keep');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('gesture speed setting', () => {
  it('defaults to quick and keeps valid stored values', () => {
    expect(sanitizeSettings(null).gestureSpeed).toBe('quick');
    expect(sanitizeSettings({ gestureSpeed: 'instant' }).gestureSpeed).toBe('instant');
    expect(sanitizeSettings({ gestureSpeed: 'calm' }).gestureSpeed).toBe('calm');
  });
  it('replaces unknown values with the default', () => {
    expect(sanitizeSettings({ gestureSpeed: 'warp' }).gestureSpeed).toBe('quick');
    expect(sanitizeSettings({ gestureSpeed: 5 }).gestureSpeed).toBe('quick');
  });
});
