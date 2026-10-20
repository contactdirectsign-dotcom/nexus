import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Panel } from '../../design/ui';
import {
  formatDuration, loadStopwatch, loadTimer, saveStopwatch, saveTimer, swElapsed, swLap, swPause, swReset, swStart,
  timerFinished, timerPause, timerRemaining, timerReset, timerSetDuration, timerStart,
  type StopwatchState, type TimerState,
} from './timeTools';

/** Plays a short beep. Browsers only allow sound after the user has interacted with the page. */
function beep(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.4);
      osc.stop(ctx.currentTime + i * 0.4 + 0.25);
    }
    window.setTimeout(() => void ctx.close(), 1800);
  } catch {
    /* no sound available */
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* ignore */
  }
}

/** Re-render every `ms` while `active`. */
function useTick(active: boolean, ms: number): number {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const id = window.setInterval(() => setN((n) => n + 1), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
  return Date.now();
}

function Stopwatch() {
  const [s, setS] = useState<StopwatchState>(loadStopwatch);
  const now = useTick(s.running, 50);
  const update = (next: StopwatchState) => {
    setS(next);
    saveStopwatch(next);
  };
  const elapsed = swElapsed(s, now);
  return (
    <Panel title="Stopwatch">
      <div className="font-display text-5xl font-semibold tabular-nums" role="timer" aria-label="Stopwatch">
        {formatDuration(elapsed, true)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {s.running ? (
          <Button variant="primary" onClick={() => update(swPause(s, Date.now()))}>Pause</Button>
        ) : (
          <Button variant="primary" onClick={() => update(swStart(s, Date.now()))}>{s.accumulatedMs > 0 ? 'Resume' : 'Start'}</Button>
        )}
        <Button onClick={() => update(swLap(s, Date.now()))} disabled={!s.running}>Lap</Button>
        <Button onClick={() => update(swReset())} disabled={!s.running && s.accumulatedMs === 0 && s.laps.length === 0}>Reset</Button>
      </div>
      {s.laps.length > 0 && (
        <ol className="mt-4 max-h-48 space-y-1 overflow-y-auto text-sm tabular-nums" aria-label="Laps">
          {s.laps
            .map((total, i) => ({ n: i + 1, total, split: total - (i > 0 ? s.laps[i - 1] : 0) }))
            .reverse()
            .map((l) => (
              <li key={l.n} className="flex justify-between border-b border-nx-line/50 py-1">
                <span className="text-nx-muted">Lap {l.n}</span>
                <span>{formatDuration(l.split, true)}</span>
                <span className="text-nx-muted">{formatDuration(l.total, true)}</span>
              </li>
            ))}
        </ol>
      )}
    </Panel>
  );
}

function Timer() {
  const [t, setT] = useState<TimerState>(loadTimer);
  const [ringing, setRinging] = useState(false);
  const now = useTick(t.running, 100);
  const rang = useRef(false);
  const remaining = timerRemaining(t, now);

  const update = useCallback((next: TimerState) => {
    setT(next);
    saveTimer(next);
  }, []);

  // When time runs out while the app is open: stop, ring once. If it ended while the app was closed,
  // it just shows as finished (a web page cannot wake itself up to ring).
  const wasOpenWhenRunning = useRef(t.running && (t.endsAt ?? 0) > Date.now());
  useEffect(() => {
    if (t.running && timerFinished(t, now)) {
      update({ ...t, running: false, endsAt: null, remainingMs: 0 });
      if (wasOpenWhenRunning.current && !rang.current) {
        rang.current = true;
        setRinging(true);
        beep();
      }
    }
  }, [t, now, update]);
  useEffect(() => {
    if (t.running) {
      wasOpenWhenRunning.current = true;
      rang.current = false;
    }
  }, [t.running]);

  const total = t.durationMs;
  const h = Math.floor(total / 3600000);
  const m = Math.floor(total / 60000) % 60;
  const s = Math.floor(total / 1000) % 60;
  const setPart = (part: 'h' | 'm' | 's', value: string) => {
    const n = Math.max(0, Math.min(part === 'h' ? 99 : 59, Math.floor(Number(value) || 0)));
    const next = { h, m, s, [part]: n };
    update(timerSetDuration(((next.h * 60 + next.m) * 60 + next.s) * 1000));
    setRinging(false);
  };
  const idle = !t.running && t.remainingMs === t.durationMs;
  const finished = !t.running && t.durationMs > 0 && t.remainingMs === 0;
  const field = 'min-h-11 w-16 rounded-xl border border-nx-line bg-nx-surface px-2 text-center text-lg tabular-nums text-nx-text';

  return (
    <Panel title="Timer" action={finished ? <Badge tone="pink">Finished</Badge> : undefined}>
      {idle ? (
        <div className="flex items-end gap-2">
          {([['h', 'Hours', h], ['m', 'Minutes', m], ['s', 'Seconds', s]] as const).map(([k, label, v]) => (
            <label key={k} className="text-xs text-nx-muted">
              {label}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={k === 'h' ? 99 : 59}
                value={v}
                onChange={(e) => setPart(k, e.target.value)}
                className={`${field} mt-1 block`}
              />
            </label>
          ))}
        </div>
      ) : (
        <div className="font-display text-5xl font-semibold tabular-nums" role="timer" aria-label="Timer">
          {formatDuration(Math.ceil(remaining / 1000) * 1000)}
        </div>
      )}
      {(ringing || finished) && (
        <p className="mt-3 rounded-xl border border-nx-pink/60 p-3 text-sm text-nx-pink" role="alert">
          Time is up.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {t.running ? (
          <Button variant="primary" onClick={() => update(timerPause(t, Date.now()))}>Pause</Button>
        ) : (
          <Button
            variant="primary"
            disabled={t.durationMs === 0}
            onClick={() => {
              setRinging(false);
              update(timerStart(t, Date.now()));
            }}
          >
            {idle ? 'Start' : finished ? 'Restart' : 'Resume'}
          </Button>
        )}
        <Button
          onClick={() => {
            setRinging(false);
            update(timerReset(t));
          }}
          disabled={idle}
        >
          Reset
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Quick timers">
        {[1, 5, 10, 25].map((min) => (
          <Button
            key={min}
            className="min-h-9 px-3 text-xs"
            disabled={t.running}
            onClick={() => {
              setRinging(false);
              update(timerSetDuration(min * 60000));
            }}
          >
            {min} min
          </Button>
        ))}
      </div>
    </Panel>
  );
}

export function TimerTab() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Timer />
      <Stopwatch />
      <p className="text-xs text-nx-muted md:col-span-2">
        Honest limit: a web page cannot ring when it is closed or your phone is locked. The timer keeps correct time
        (it works from the clock, not from counting) and shows that it finished, with a beep, only while NEXUS is open.
        Dependable background alarms would need a native Android app later.
      </p>
    </div>
  );
}
