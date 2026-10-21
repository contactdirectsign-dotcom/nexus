import { useEffect, useRef } from 'react';
import { subscribeAirCursor } from '../gestures/airPointer';

const R = 15; // ring radius (viewBox 40)
const CIRC = 2 * Math.PI * R;

/**
 * The cursor you control with your index finger. Drawn over everything, never blocks touches
 * (pointer-events: none).
 *
 * Built to be cheap: one element moves (a single transform per frame); colours, glow and the progress arc are
 * only touched when the state actually changes, and nothing uses live blur or filters.
 *  - A small bright dot is the exact aim point; a thin ring around it fills as you close a pinch.
 *  - The ring grows when you are over something clickable and shrinks while pressed.
 *  - A quick ripple marks each click; dashes show scroll mode.
 */
export function AirCursor() {
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const core = useRef<HTMLDivElement>(null);
  const shown = useRef({ mode: 'hidden', hovering: false, closing: -1 });

  useEffect(
    () =>
      subscribeAirCursor((v) => {
        const el = root.current;
        const b = body.current;
        if (!el || !b) return;
        const reduced = document.documentElement.dataset.reduced === 'true';
        const s = shown.current;

        if (v.mode === 'hidden') {
          if (s.mode !== 'hidden') el.style.opacity = '0';
          s.mode = 'hidden';
          return;
        }
        const x = v.x * window.innerWidth;
        const y = v.y * window.innerHeight;
        const pressed = v.mode === 'pressed';
        const scroll = v.mode === 'scroll';

        // The only thing that changes every frame:
        b.style.transform = `translate3d(${x}px, ${y}px, 0)`;

        if (s.mode === 'hidden') el.style.opacity = '1';
        if (pressed && s.mode !== 'pressed' && !reduced) {
          const ripple = document.createElement('div');
          ripple.className = 'nx-ripple';
          ripple.style.left = `${x}px`;
          ripple.style.top = `${y}px`;
          ripple.addEventListener('animationend', () => ripple.remove());
          el.appendChild(ripple);
        }

        if (s.mode !== v.mode || s.hovering !== v.hovering) {
          if (ring.current) {
            ring.current.style.transform = `translate(-50%, -50%) scale(${pressed ? 0.7 : v.hovering ? 1.25 : 1})`;
            ring.current.dataset.state = pressed ? 'pressed' : scroll ? 'scroll' : v.hovering ? 'hover' : 'idle';
          }
          if (core.current) core.current.dataset.state = pressed ? 'pressed' : v.hovering ? 'hover' : 'idle';
        }
        const closing = scroll ? 0 : Math.round(v.closing * 20) / 20;
        if (arc.current && s.closing !== closing) {
          arc.current.style.strokeDashoffset = String(CIRC * (1 - closing));
        }
        s.mode = v.mode;
        s.hovering = v.hovering;
        s.closing = closing;
      }),
    [],
  );

  return (
    <div ref={root} aria-hidden="true" data-testid="air-cursor" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden opacity-0">
      <div ref={body} className="absolute left-0 top-0 will-change-transform">
        <div ref={ring} className="nx-cur-ring" data-state="idle">
          <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90" fill="none" strokeWidth="2">
            <circle className="nx-cur-ring-base" cx="20" cy="20" r={R} />
            <circle
              ref={arc}
              cx="20"
              cy="20"
              r={R}
              stroke="#ffffff"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC}
            />
          </svg>
        </div>
        <div ref={core} className="nx-cur-core" data-state="idle" />
      </div>
    </div>
  );
}
