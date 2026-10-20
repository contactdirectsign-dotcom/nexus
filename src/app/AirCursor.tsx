import { useEffect, useRef } from 'react';
import { subscribeAirCursor } from '../gestures/airPointer';

const TRAIL = 7;
const R = 22; // ring radius
const CIRC = 2 * Math.PI * R;

/**
 * The glowing cursor you control with your index finger. Drawn over everything, never blocks touches
 * (pointer-events: none), and updated directly rather than through React state so it stays smooth.
 *
 *  - The ring fills as you close a pinch, so you can see the click coming.
 *  - It locks on (turns white and grows) when it is over something clickable.
 *  - A ripple shows each click; arrows show scroll mode.
 */
export function AirCursor() {
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const ringBase = useRef<SVGCircleElement>(null);
  const core = useRef<HTMLDivElement>(null);
  const arrows = useRef<HTMLDivElement>(null);
  const trail = useRef<Array<HTMLDivElement | null>>([]);
  const history = useRef<Array<{ x: number; y: number }>>([]);
  const prevMode = useRef<string>('hidden');

  useEffect(
    () =>
      subscribeAirCursor((v) => {
        const el = root.current;
        if (!el) return;
        const reduced = document.documentElement.dataset.reduced === 'true';

        if (v.mode === 'hidden') {
          el.style.opacity = '0';
          history.current = [];
          prevMode.current = 'hidden';
          return;
        }
        const x = v.x * window.innerWidth;
        const y = v.y * window.innerHeight;
        const pressed = v.mode === 'pressed';
        const scroll = v.mode === 'scroll';

        if (prevMode.current === 'hidden') {
          // Fresh appearance: start the trail at the cursor so it does not streak from the last spot.
          history.current = [];
          if (body.current && !reduced && typeof body.current.animate === 'function') {
            body.current.animate(
              [{ transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(0.3)` }, { transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(1)` }],
              { duration: 180, easing: 'cubic-bezier(.2,1.4,.4,1)' },
            );
          }
        }
        if (pressed && prevMode.current !== 'pressed' && !reduced) {
          const ripple = document.createElement('div');
          ripple.className = 'nx-ripple';
          ripple.style.left = `${x}px`;
          ripple.style.top = `${y}px`;
          ripple.addEventListener('animationend', () => ripple.remove());
          el.appendChild(ripple);
        }
        prevMode.current = v.mode;
        el.style.opacity = '1';

        const scale = pressed ? 0.8 : v.hovering ? 1.18 : 1;
        if (body.current) body.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
        if (arc.current) {
          arc.current.style.strokeDashoffset = String(CIRC * (1 - (scroll ? 0 : v.closing)));
          arc.current.style.stroke = pressed ? '#ffffff' : '#ff6ec7';
        }
        if (ringBase.current) {
          ringBase.current.style.stroke = v.hovering ? '#ffffff' : 'rgba(255,45,149,0.55)';
          ringBase.current.style.strokeDasharray = scroll ? '4 5' : 'none';
        }
        if (core.current) {
          core.current.style.background = pressed ? '#ffffff' : '#ff2d95';
          core.current.style.boxShadow = pressed ? '0 0 26px 6px rgba(255,255,255,0.8)' : '0 0 18px 4px rgba(255,45,149,0.8)';
          core.current.style.transform = `translate(-50%, -50%) scale(${pressed ? 1.35 : 1})`;
        }
        if (arrows.current) arrows.current.style.opacity = scroll ? '1' : '0';

        if (!reduced) {
          const h = history.current;
          h.unshift({ x, y });
          if (h.length > TRAIL * 2 + 1) h.length = TRAIL * 2 + 1;
          trail.current.forEach((t, i) => {
            const p = h[Math.min(h.length - 1, (i + 1) * 2)];
            if (!t || !p) return;
            t.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%) scale(${1 - i * 0.12})`;
            t.style.opacity = String(Math.max(0, 0.5 - i * 0.07));
          });
        }
      }),
    [],
  );

  return (
    <div
      ref={root}
      aria-hidden="true"
      data-testid="air-cursor"
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden opacity-0 transition-opacity duration-150"
    >
      {Array.from({ length: TRAIL }, (_, i) => (
        <div
          key={i}
          ref={(n) => {
            trail.current[i] = n;
          }}
          className="absolute left-0 top-0 h-3 w-3 rounded-full"
          style={{ background: 'radial-gradient(circle, #ff6ec7, #ff2d95 60%, transparent 70%)', opacity: 0 }}
        />
      ))}
      <div ref={body} className="absolute left-0 top-0 h-14 w-14 will-change-transform">
        <svg viewBox="0 0 56 56" className="absolute inset-0 h-full w-full -rotate-90" fill="none" strokeWidth="2.5">
          <circle ref={ringBase} cx="28" cy="28" r={R} stroke="rgba(255,45,149,0.55)" />
          <circle
            ref={arc}
            cx="28"
            cy="28"
            r={R}
            stroke="#ff6ec7"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC}
            style={{ filter: 'drop-shadow(0 0 4px #ff2d95)' }}
          />
        </svg>
        <div ref={core} className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-nx-pink" />
        <div ref={arrows} className="absolute inset-0 text-[10px] leading-none text-white opacity-0 transition-opacity">
          <span className="absolute left-1/2 -top-3 -translate-x-1/2">▲</span>
          <span className="absolute -bottom-3 left-1/2 -translate-x-1/2">▼</span>
        </div>
      </div>
    </div>
  );
}
