import { useSyncExternalStore } from 'react';
import {
  ACTIONS,
  DEFAULT_MAPPINGS,
  isGestureId,
  type GestureMappings,
} from '../gestures/definitions';

export type Hand = 'right' | 'left' | 'either' | 'both';
export type TimeFormat = '12h' | '24h';

export interface Settings {
  version: 1;
  /** True once the first-time gesture setup wizard has been completed (wizard arrives in Phase 2). */
  setupComplete: boolean;
  hand: Hand;
  timeFormat: TimeFormat;
  /** Turns off glow, blur and animation for low-power phones. */
  reducedEffects: boolean;
  /** Master switch for camera gestures. Stays false until the user enables it. */
  gestureEnabled: boolean;
  /** 0 (strict, fewer accidental triggers) to 1 (sensitive). */
  sensitivity: number;
  /** Show the small live hand-tracking camera in the top right while the camera is on. */
  showHandCam: boolean;
  mappings: GestureMappings;
}

export const STORAGE_KEY = 'nexus.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  setupComplete: false,
  hand: 'either',
  timeFormat: '24h',
  reducedEffects: false,
  gestureEnabled: false,
  sensitivity: 0.5,
  showHandCam: true,
  mappings: DEFAULT_MAPPINGS,
};

const HANDS: readonly Hand[] = ['right', 'left', 'either', 'both'];

/** Turn untrusted stored data into valid settings, falling back to defaults per field. */
export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (typeof raw !== 'object' || raw === null) return { ...d, mappings: { ...d.mappings } };
  const r = raw as Record<string, unknown>;

  // A gesture may trigger only one action. Pass 1 keeps valid stored choices (and explicit
  // "disabled"); pass 2 fills anything missing/invalid from defaults, but only if that default
  // gesture is still free. Otherwise the action stays unassigned instead of creating a clash.
  const stored =
    typeof r.mappings === 'object' && r.mappings !== null ? (r.mappings as Record<string, unknown>) : {};
  const mappings = { ...d.mappings };
  const used = new Set<string>();
  const pending: typeof ACTIONS[number]['id'][] = [];
  for (const a of ACTIONS) {
    const v = stored[a.id];
    if (v === null) {
      mappings[a.id] = null;
    } else if (isGestureId(v) && !used.has(v)) {
      mappings[a.id] = v;
      used.add(v);
    } else {
      pending.push(a.id);
    }
  }
  for (const id of pending) {
    const fallback = d.mappings[id];
    if (fallback !== null && !used.has(fallback)) {
      mappings[id] = fallback;
      used.add(fallback);
    } else {
      mappings[id] = null;
    }
  }

  const sens = typeof r.sensitivity === 'number' && Number.isFinite(r.sensitivity) ? r.sensitivity : d.sensitivity;

  return {
    version: 1,
    setupComplete: typeof r.setupComplete === 'boolean' ? r.setupComplete : d.setupComplete,
    hand: HANDS.includes(r.hand as Hand) ? (r.hand as Hand) : d.hand,
    timeFormat: r.timeFormat === '12h' || r.timeFormat === '24h' ? r.timeFormat : d.timeFormat,
    reducedEffects: typeof r.reducedEffects === 'boolean' ? r.reducedEffects : d.reducedEffects,
    gestureEnabled: typeof r.gestureEnabled === 'boolean' ? r.gestureEnabled : d.gestureEnabled,
    sensitivity: Math.min(1, Math.max(0, sens)),
    showHandCam: typeof r.showHandCam === 'boolean' ? r.showHandCam : d.showHandCam,
    mappings,
  };
}

function load(): Settings {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    return sanitizeSettings(text ? JSON.parse(text) : null);
  } catch {
    // Storage blocked or data corrupted: start from defaults instead of crashing.
    return sanitizeSettings(null);
  }
}

let current: Settings = load();
const listeners = new Set<() => void>();

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore: the app keeps working for this session even if saving fails.
  }
}

function emit(): void {
  listeners.forEach((l) => l());
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Omit<Settings, 'version'>>): void {
  current = sanitizeSettings({ ...current, ...patch });
  persist();
  emit();
}

export function resetSettings(): void {
  current = sanitizeSettings(null);
  persist();
  emit();
}

/** Remove everything NEXUS stored in this browser, then reset in memory. */
export function eraseAllLocalData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('nexus.')) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
  current = sanitizeSettings(null);
  emit();
}

/** Re-read from storage (used by tests). */
export function reloadSettings(): void {
  current = load();
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
