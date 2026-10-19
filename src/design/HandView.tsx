import { useEffect, useRef } from 'react';
import { engine, useEngine } from '../gestures/engine';
import { HAND_CONNECTIONS } from '../gestures/landmarks';

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
        ctx.lineWidth = 2 * scale;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#ff2d95';
        ctx.fillStyle = '#ffffff';
        for (const hand of hands) {
          ctx.beginPath();
          for (const [a, b] of HAND_CONNECTIONS) {
            ctx.moveTo(hand[a].x * canvas.width, hand[a].y * canvas.height);
            ctx.lineTo(hand[b].x * canvas.width, hand[b].y * canvas.height);
          }
          ctx.stroke();
          for (const p of hand) {
            ctx.beginPath();
            ctx.arc(p.x * canvas.width, p.y * canvas.height, 2.2 * scale, 0, Math.PI * 2);
            ctx.fill();
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
