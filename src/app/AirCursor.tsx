import { useEffect, useRef } from 'react';
import { subscribeAirCursor } from '../gestures/airPointer';

const TRAIL = 6;

/**
 * The glowing cursor you control with your index finger. It is drawn on top of everything, never blocks
 * touches (pointer-events: none), and is updated directly (not through React state) so it stays smooth.
 */
export function AirCursor() {
  const root = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const trail = useRef<Array<HTMLDivElement | null>>([]);
  const history = useRef<Array<{ x: number; y: number }>>([]);

  useEffect(
    () =>
      subscribeAirCursor((v) => {
        const el = root.current;
        if (!el) return;
        if (v.mode === 'hidden') {
          el.style.opacity = '0';
          history.current = [];
          return;
        }
        el.style.opacity = '1';
        const x = v.x * window.innerWidth;
        const y = v.y * window.innerHeight;
        const pressed = v.mode === 'pressed';
        if (dot.current) {
          dot.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${pressed ? 1.5 : 1})`;
          dot.current.style.background = pressed ? '#ffffff' : '#ff2d95';
        }
        if (ring.current) {
          // The ring shrinks as the pinch closes, so you can see the click coming.
          const size = v.mode === 'scroll' ? 46 : 46 - 26 * v.closing;
          ring.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
          ring.current.style.width = ring.current.style.height = `${size}px`;
          ring.current.style.borderColor = v.hovering ? '#ffffff' : '#ff2d95';
          ring.current.style.borderStyle = v.mode === 'scroll' ? 'dashed' : 'solid';
          ring.current.style.boxShadow = pressed ? '0 0 22px #ff2d95' : '0 0 12px rgba(255,45,149,0.7)';
        }
        const h = history.current;
        h.unshift({ x, y });
        if (h.length > TRAIL * 2) h.length = TRAIL * 2;
        trail.current.forEach((t, i) => {
          const p = h[Math.min(h.length - 1, (i + 1) * 2)];
          if (!t || !p) return;
          t.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%) scale(${1 - i * 0.14})`;
          t.style.opacity = String(0.45 - i * 0.07);
        });
      }),
    [],
  );

  return (
    <div ref={root} aria-hidden="true" data-testid="air-cursor" className="pointer-events-none fixed inset-0 z-[60] opacity-0 transition-opacity duration-150">
      {Array.from({ length: TRAIL }, (_, i) => (
        <div
          key={i}
          ref={(n) => {
            trail.current[i] = n;
          }}
          className="absolute left-0 top-0 h-3 w-3 rounded-full bg-nx-pink"
        />
      ))}
      <div ref={ring} className="absolute left-0 top-0 rounded-full border-2 border-nx-pink" style={{ width: 46, height: 46 }} />
      <div ref={dot} className="absolute left-0 top-0 h-3.5 w-3.5 rounded-full bg-nx-pink" />
    </div>
  );
}
