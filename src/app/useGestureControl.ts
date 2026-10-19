import { useEffect, useRef } from 'react';
import { registerActionHandler, runAction } from '../gestures/actionRegistry';
import { ACTIONS } from '../gestures/definitions';
import { engine } from '../gestures/engine';
import type { Route } from '../lib/useHashRoute';
import { getSettings, useSettings } from '../storage/settings';
import { NAV_ITEMS } from './navigation';

/**
 * Connects the camera engine to the app:
 *  - keeps engine settings (sensitivity, hand) in sync,
 *  - turns recognised gestures into actions using the user's saved assignments,
 *  - provides the app-wide default meaning of each action,
 *  - restarts the camera automatically only if the browser already granted permission.
 */
export function useGestureControl(route: Route, navigate: (r: Route) => void): void {
  const settings = useSettings();
  const routeRef = useRef(route);
  routeRef.current = route;

  useEffect(() => {
    engine.setConfig({ sensitivity: settings.sensitivity, hand: settings.hand });
  }, [settings.sensitivity, settings.hand]);

  // Default behaviour of each action. Screens can register their own handlers on top (later phases).
  useEffect(() => {
    const move = (step: number) => () => {
      const i = NAV_ITEMS.findIndex((n) => n.route === routeRef.current);
      if (i < 0) return false;
      navigate(NAV_ITEMS[(i + step + NAV_ITEMS.length) % NAV_ITEMS.length].route);
      return true;
    };
    const scroll = (dir: 1 | -1) => () => {
      const reduced = document.documentElement.dataset.reduced === 'true';
      window.scrollBy({ top: dir * window.innerHeight * 0.6, behavior: reduced ? 'auto' : 'smooth' });
      return true;
    };
    const offs = [
      registerActionHandler('next-panel', move(1)),
      registerActionHandler('previous-panel', move(-1)),
      registerActionHandler('scroll-up', scroll(-1)),
      registerActionHandler('scroll-down', scroll(1)),
      registerActionHandler('back', () => {
        if (routeRef.current === 'dashboard') return false;
        navigate('dashboard');
        return true;
      }),
      registerActionHandler('select', () => {
        const el = document.activeElement;
        if (el instanceof HTMLElement && (el.tagName === 'BUTTON' || el.tagName === 'A')) {
          el.click();
          return true;
        }
        return false;
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [navigate]);

  // Gesture events -> actions
  useEffect(
    () =>
      engine.onEvent((event) => {
        // The setup wizard reads raw gestures itself; do not navigate away while practising.
        if (routeRef.current === 'setup') return;
        const mappings = getSettings().mappings;
        const action = ACTIONS.find((a) => mappings[a.id] === event.gesture);
        if (!action) return;

        const status = engine.getSnapshot().status;
        if (action.id === 'pause') {
          engine.setPaused(status !== 'paused');
          engine.reportAction('pause');
          return;
        }
        if (status === 'paused') return; // while paused, only the pause gesture works
        if (runAction(action.id)) engine.reportAction(action.id);
      }),
    [],
  );

  // Auto-start only when the browser already remembers camera permission (no surprise prompt).
  useEffect(() => {
    if (!settings.gestureEnabled || !settings.setupComplete) return;
    let cancelled = false;
    (async () => {
      try {
        const perm = await navigator.permissions?.query({ name: 'camera' as PermissionName });
        if (!cancelled && perm?.state === 'granted' && engine.getSnapshot().status === 'idle') {
          void engine.start();
        }
      } catch {
        // Permissions API not supported: the user can press "Start camera".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.gestureEnabled, settings.setupComplete]);
}
