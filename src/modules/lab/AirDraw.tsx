import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Panel } from '../../design/ui';
import { addPoint, BRUSH_COLORS, BRUSH_SIZES, smoothSegments, type Stroke } from './labLogic';

/**
 * A drawing board. It uses ordinary pointer events, so it works with a finger, a mouse, a pen, and with the
 * air cursor: pinch and drag to draw, release to lift the pen.
 */
export function AirDraw() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState<string>(BRUSH_COLORS[0].value);
  const [size, setSize] = useState<number>(BRUSH_SIZES[1].value);
  const drawing = useRef<Stroke | null>(null);

  const paint = useCallback((list: readonly Stroke[], live: Stroke | null) => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#05020a';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of live ? [...list, live] : list) {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = Math.max(1, s.width * c.width);
      ctx.shadowColor = s.color;
      ctx.shadowBlur = Math.max(6, s.width * c.width * 3);
      if (s.points.length === 1) {
        ctx.beginPath();
        ctx.arc(s.points[0].x * c.width, s.points[0].y * c.height, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      const segs = smoothSegments(s.points);
      ctx.beginPath();
      if (segs.length === 0 && s.points.length === 2) {
        ctx.moveTo(s.points[0].x * c.width, s.points[0].y * c.height);
        ctx.lineTo(s.points[1].x * c.width, s.points[1].y * c.height);
      } else {
        ctx.moveTo(segs[0].from.x * c.width, segs[0].from.y * c.height);
        for (const g of segs) ctx.quadraticCurveTo(g.control.x * c.width, g.control.y * c.height, g.to.x * c.width, g.to.y * c.height);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }, []);

  // Keep the canvas sharp and the right size; redraw after a resize.
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  useEffect(() => {
    const el = wrap.current;
    const c = canvas.current;
    if (!el || !c) return undefined;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.max(1, Math.round(el.clientWidth * dpr));
      c.height = Math.max(1, Math.round(el.clientHeight * dpr));
      paint(strokesRef.current, drawing.current);
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(el);
    resize();
    return () => ro?.disconnect();
  }, [paint]);

  useEffect(() => paint(strokes, null), [strokes, paint]);

  const pos = (e: React.PointerEvent): { x: number; y: number } => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) };
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic pointer (air cursor) */
    }
    drawing.current = { color, width: size, points: [pos(e)] };
    paint(strokes, drawing.current);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawing.current) return;
    drawing.current = addPoint(drawing.current, pos(e));
    paint(strokes, drawing.current);
  };
  const onUp = () => {
    const s = drawing.current;
    drawing.current = null;
    if (s) setStrokes((list) => [...list, s].slice(-300));
  };

  const save = () => {
    canvas.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nexus-air-drawing.png';
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

  return (
    <Panel title="Air Draw" glow>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Brush">
        {BRUSH_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={`${c.name} brush`}
            aria-pressed={color === c.value}
            onClick={() => setColor(c.value)}
            className={`h-11 w-11 rounded-full border-2 ${color === c.value ? 'border-white' : 'border-nx-line'}`}
            style={{ background: c.value, boxShadow: color === c.value ? `0 0 14px ${c.value}` : undefined }}
          />
        ))}
        <span className="mx-1 h-6 w-px bg-nx-line" aria-hidden="true" />
        {BRUSH_SIZES.map((s) => (
          <Button key={s.name} variant={size === s.value ? 'primary' : 'ghost'} aria-pressed={size === s.value} onClick={() => setSize(s.value)} className="min-h-11 px-3">
            {s.name}
          </Button>
        ))}
      </div>
      <div
        ref={wrap}
        className="relative aspect-[4/3] w-full cursor-crosshair overflow-hidden rounded-xl border border-nx-line bg-black"
        style={{ touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        data-testid="draw-surface"
        role="img"
        aria-label="Drawing board"
      >
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
        {strokes.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-nx-muted">
            Draw here with your finger or mouse. With the camera on: point to aim, then pinch and drag to draw.
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => setStrokes((l) => l.slice(0, -1))} disabled={strokes.length === 0}>
          Undo
        </Button>
        <Button variant="danger" onClick={() => setStrokes([])} disabled={strokes.length === 0}>
          Clear
        </Button>
        <Button onClick={save} disabled={strokes.length === 0}>
          Save picture
        </Button>
      </div>
      <p className="mt-3 text-xs text-nx-muted">Drawings stay in this page only; nothing is uploaded. Save picture downloads a PNG.</p>
    </Panel>
  );
}
