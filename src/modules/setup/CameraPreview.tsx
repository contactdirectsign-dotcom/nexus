import { useEffect, useRef } from 'react';
import { engine, useEngine } from '../../gestures/engine';
import { HAND_CONNECTIONS } from '../../gestures/landmarks';

/**
 * Mirror-style live preview with the detected hand skeleton drawn on top.
 * The video is only displayed here; it is never recorded or sent anywhere.
 */
export function CameraPreview() {
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
        ctx.lineWidth = Math.max(2, canvas.width / 200);
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
            ctx.arc(p.x * canvas.width, p.y * canvas.height, ctx.lineWidth * 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }),
    [],
  );

  return (
    <div
      className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-xl border border-nx-line bg-black"
      data-testid="camera-preview"
    >
      {/* Mirrored so it behaves like a mirror: your right hand appears on the right. */}
      <div className="absolute inset-0 [transform:scaleX(-1)]">
        <video ref={videoRef} muted playsInline autoPlay className="h-full w-full object-contain" />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain" />
      </div>
      {!live && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-nx-muted">
          Camera is off
        </div>
      )}
    </div>
  );
}
