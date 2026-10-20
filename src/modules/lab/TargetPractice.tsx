import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Panel } from '../../design/ui';
import { GAME_SECONDS, loadBest, nextTarget, saveBest, summarize, type GameResult, type TargetSpot } from './labLogic';

const TARGET_LIFE_MS = 1700;

type Phase = 'idle' | 'playing' | 'done';

/** A 30-second aiming game: pop the glowing targets. A great way to feel out the air cursor. */
export function TargetPractice() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [spot, setSpot] = useState<TargetSpot>({ x: 50, y: 50 });
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [left, setLeft] = useState(GAME_SECONDS);
  const [result, setResult] = useState<GameResult | null>(null);
  const [record, setRecord] = useState(false);
  const [best, setBest] = useState(loadBest);
  const stats = useRef({ hits: 0, misses: 0 });
  const endAt = useRef(0);
  const spotRef = useRef(spot);
  spotRef.current = spot;

  const spawn = useCallback(() => setSpot((prev) => nextTarget(Math.random, prev)), []);

  const start = () => {
    stats.current = { hits: 0, misses: 0 };
    setHits(0);
    setMisses(0);
    setResult(null);
    setRecord(false);
    setLeft(GAME_SECONDS);
    endAt.current = Date.now() + GAME_SECONDS * 1000;
    spawn();
    setPhase('playing');
  };

  // Clock
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const id = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        const r = summarize(stats.current.hits, stats.current.misses);
        setResult(r);
        setRecord(saveBest(r.hits));
        setBest(loadBest());
        setPhase('done');
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [phase]);

  // A target that is not popped in time counts as a miss and moves.
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const id = window.setTimeout(() => {
      stats.current.misses += 1;
      setMisses(stats.current.misses);
      spawn();
    }, TARGET_LIFE_MS);
    return () => window.clearTimeout(id);
  }, [phase, spot, spawn]);

  const pop = () => {
    stats.current.hits += 1;
    setHits(stats.current.hits);
    spawn();
  };

  return (
    <Panel title="Target practice" action={best > 0 ? <Badge tone="pink">Best: {best}</Badge> : undefined}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm" aria-live="polite">
        <span>
          Score: <strong data-testid="score">{hits}</strong>
        </span>
        <span>Time: {phase === 'playing' ? `${left}s` : `${GAME_SECONDS}s round`}</span>
        <span className="text-nx-muted">Missed: {misses}</span>
      </div>
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-nx-line bg-black"
        style={{ touchAction: 'none' }}
        data-testid="arena"
      >
        {phase === 'playing' && (
          <button
            type="button"
            data-air-target
            aria-label="Target"
            onPointerDown={pop}
            className="absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-nx-pink shadow-[0_0_28px_#ff2d95] transition-transform active:scale-90"
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          />
        )}
        {phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            {phase === 'done' && result ? (
              <>
                <p className="font-display text-2xl font-semibold">{result.hits} targets</p>
                <p className="text-sm text-nx-muted">
                  {result.perMinute} per minute · {result.accuracy}% accuracy
                  {record && <span className="text-nx-pink"> · New best!</span>}
                </p>
              </>
            ) : (
              <p className="text-sm text-nx-muted">
                Pop as many targets as you can in {GAME_SECONDS} seconds. Tap them, or point with your index finger and pinch.
              </p>
            )}
            <Button variant="primary" onClick={start}>
              {phase === 'done' ? 'Play again' : 'Start'}
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}
