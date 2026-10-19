import { useEffect, useRef } from 'react';
import { engine, useEngine } from '../gestures/engine';
import { HAND_CONNECTIONS } from '../gestures/landmarks';

const PALM = [0, 1, 5, 9, 13, 17];
const PALM_EDGES = new Set(['0-1', '0-5', '5-9', '9-13', '13-17', '0-17']);
const TIPS = new Set([4, 8, 12, 16, 20]);
const FINGERS = [
  { ids: [1, 2, 3, 4], color: '#ffd166', glow: 'rgba(255,209,102,0.25)' }, // thumb
  { ids: [5, 6, 7, 8], color: '#ff2d95', glow: 'rgba(255,45,149,0.28)' }, // index
  { ids: [9, 10, 11, 12], color: '#ff6ec7', glow: 'rgba(255,110,199,0.28)' }, // middle
  { ids: [13, 14, 15, 16], color: '#c77dff', glow: 'rgba(199,125,255,0.28)' }, // ring
  { ids: [17, 18, 19, 20], color: '#7ae7ff', glow: 'rgba(122,231,255,0.25)' }, // little
];

/**
 * Live mirror-style camera view with the detected hand skeleton on top.
 * Used big in the setup wizard and tiny in the top-right "video call" window.
 * The video is only displayed; it is never recorded or sent anywhere.
 */
export function HandView({ className = '', emptyText = 'Camera is off' }: { className?: string; emptyText?: string }) {
  const cam = useEngine();
  const live = cam.status === 'running' || cam.status === 'paused';
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = live ? engine.getStream() : null;
    if (live) void video.play().catch(() => undefined);
    return () => {
      video.srcObject = null;
    };
  }, [live]);

  useEffect(
    () =>
      engine.subscribeFrames((hands, size) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || size.width === 0) return;
        if (canvas.width !== size.width || canvas.height !== size.height) {
          canvas.width = size.width;
          canvas.height = size.height;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Keep lines a constant on-screen thickness whether the view is tiny or large.
        const scale = canvas.width / Math.max(1, canvas.clientWidth || canvas.width);
        const W = canvas.width;
        const H = canvas.height;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const hand of hands) {
          if (hand.length < 21) continue;
          const px = (i: number) => hand[i].x * W;
          const py = (i: number) => hand[i].y * H;

          // Soft filled palm so the hand reads as a hand, not loose sticks.
          ctx.beginPath();
          PALM.forEach((i, k) => (k === 0 ? ctx.moveTo(px(i), py(i)) : ctx.lineTo(px(i), py(i))));
          ctx.closePath();
          ctx.fillStyle = 'rgba(255,45,149,0.18)';
          ctx.fill();

          // Bones: each finger has its own colour; bones get thinner toward the fingertip. A wider,
          // translucent pass underneath gives a neon glow.
          for (const finger of FINGERS) {
            for (let k = 0; k < finger.ids.length - 1; k++) {
              const a = finger.ids[k];
              const b = finger.ids[k + 1];
              const w = (2.6 - k * 0.4) * scale;
              ctx.strokeStyle = finger.glow;
              ctx.lineWidth = w * 3;
              ctx.beginPath();
              ctx.moveTo(px(a), py(a));
              ctx.lineTo(px(b), py(b));
              ctx.stroke();
              ctx.strokeStyle = finger.color;
              ctx.lineWidth = w;
              ctx.beginPath();
              ctx.moveTo(px(a), py(a));
              ctx.lineTo(px(b), py(b));
              ctx.stroke();
            }
          }
          // Palm outline (knuckle line and sides).
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 1.5 * scale;
          ctx.beginPath();
          for (const [a, b] of HAND_CONNECTIONS) {
            if (PALM_EDGES.has(`${a}-${b}`)) {
              ctx.moveTo(px(a), py(a));
              ctx.lineTo(px(b), py(b));
            }
          }
          ctx.stroke();

          // Joints: small dots, bigger bright fingertips, a large wrist anchor.
          for (let i = 0; i < hand.length; i++) {
            const tip = TIPS.has(i);
            const r = (i === 0 ? 4 : tip ? 3.6 : 2.2) * scale;
            ctx.beginPath();
            ctx.arc(px(i), py(i), r, 0, Math.PI * 2);
            ctx.fillStyle = tip ? '#ffffff' : i === 0 ? '#ff2d95' : 'rgba(255,255,255,0.9)';
            ctx.fill();
            if (tip || i === 0) {
              ctx.strokeStyle = '#ff2d95';
              ctx.lineWidth = 1.2 * scale;
              ctx.stroke();
            }
          }
        }
      }),
    [],
  );

  return (
    <div className={`relative aspect-[4/3] overflow-hidden rounded-lg bg-black ${className}`}>
      {/* Mirrored so it behaves like a mirror: your right hand appears on the right. */}
      <div className="absolute inset-0 [transform:scaleX(-1)]">
        <video ref={videoRef} muted playsInline autoPlay className="h-full w-full object-contain" />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain" />
      </div>
      {!live && (
        <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-nx-muted">
          {emptyText}
        </div>
      )}
    </div>
  );
}
