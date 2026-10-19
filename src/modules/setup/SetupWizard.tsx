import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Badge, Button, Panel, ProgressBar } from '../../design/ui';
import { ACTIONS, GESTURES, getGesture } from '../../gestures/definitions';
import { engine, useEngine } from '../../gestures/engine';
import { go } from '../../lib/useHashRoute';
import { getSettings, updateSettings, useSettings, type Hand } from '../../storage/settings';
import { GestureAssignments } from '../settings/GestureAssignments';
import { CameraPreview } from './CameraPreview';

const STAGES = ['welcome', 'camera', 'hand', 'calibrate', 'assign', 'test', 'done'] as const;
type Stage = (typeof STAGES)[number];

const TITLES: Record<Stage, string> = {
  welcome: 'Welcome',
  camera: 'Camera access',
  hand: 'Your hand',
  calibrate: 'Calibration',
  assign: 'Assign gestures',
  test: 'Practice',
  done: 'All set',
};

function Steps({ index }: { index: number }) {
  return (
    <ol className="mb-4 flex gap-1.5" aria-label="Setup progress">
      {STAGES.map((s, i) => (
        <li
          key={s}
          aria-current={i === index ? 'step' : undefined}
          className={`h-1.5 flex-1 rounded-full ${i <= index ? 'bg-nx-pink' : 'bg-nx-line'}`}
          title={TITLES[s]}
        />
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------------------
// Stage A: welcome
function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="font-display text-4xl font-bold tracking-[0.25em] text-nx-pink">NEXUS</p>
      <p className="text-nx-muted">Your World. Your Gestures. Your Control.</p>
      <p className="text-sm">
        NEXUS can be controlled with hand gestures. To see your hand it needs to use your <strong>camera</strong>.
        Setup takes about two minutes: allow the camera, pick your hand, check tracking, choose your gestures and
        practise them.
      </p>
      <ul className="list-inside list-disc text-sm text-nx-muted">
        <li>Video is analysed on this device and is never recorded, saved or uploaded.</li>
        <li>You can pause or stop the camera at any time; a red indicator shows whenever it is on.</li>
        <li>Touch, mouse and keyboard always work, so gestures are optional.</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={onNext}>
          Start setup
        </Button>
        <Button onClick={() => go('dashboard')}>Skip: use touch only</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Stage B: camera permission
function CameraStage({ onNext }: { onNext: () => void }) {
  const cam = useEngine();
  const ready = cam.status === 'running' || cam.status === 'paused';
  const busy = cam.status === 'requesting' || cam.status === 'loading';

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm">
        Tap the button below. Your browser will ask whether NEXUS may use the camera. NEXUS uses it only to find
        your hand; nothing is recorded or sent anywhere.
      </p>
      {ready ? (
        <>
          <Badge tone="ok">Camera connected</Badge>
          <Button variant="primary" onClick={onNext}>
            Continue
          </Button>
        </>
      ) : (
        <>
          <Button variant="primary" disabled={busy} onClick={() => void engine.start()}>
            {busy ? (cam.status === 'requesting' ? 'Waiting for permission…' : 'Loading hand tracking…') : 'Allow camera'}
          </Button>
          {cam.status === 'loading' && (
            <p className="text-xs text-nx-muted">
              The hand-tracking model is downloaded once (a few MB). This can take a moment on mobile data.
            </p>
          )}
          {cam.status === 'error' && cam.error && (
            <div role="alert" className="rounded-xl border border-nx-warn/60 p-3 text-sm text-nx-warn">
              {cam.error}
            </div>
          )}
          <p className="text-xs text-nx-muted">
            If you tap "Block" you can still use NEXUS with touch controls, and change your mind later in Settings.
          </p>
          <Button onClick={() => go('dashboard')}>Continue without camera (touch only)</Button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Stage C: hand choice
const HAND_OPTIONS: Array<{ value: Hand; label: string; hint: string }> = [
  { value: 'right', label: 'Right hand', hint: 'Only your right hand controls NEXUS.' },
  { value: 'left', label: 'Left hand', hint: 'Only your left hand controls NEXUS.' },
  { value: 'either', label: 'Either hand', hint: 'Whichever hand NEXUS sees first.' },
  { value: 'both', label: 'Both hands', hint: 'Either hand can control it (two-hand gestures are not available yet).' },
];

function HandStage() {
  const settings = useSettings();
  return (
    <div role="radiogroup" aria-label="Preferred hand" className="grid gap-2 sm:grid-cols-2">
      {HAND_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={settings.hand === o.value}
          onClick={() => updateSettings({ hand: o.value })}
          className={`rounded-xl border p-3 text-left ${
            settings.hand === o.value ? 'border-nx-pink bg-nx-pink/10' : 'border-nx-line'
          }`}
        >
          <div className="font-display text-lg font-semibold">{o.label}</div>
          <div className="text-xs text-nx-muted">{o.hint}</div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Stage D: calibration
function CalibrateStage() {
  const cam = useEngine();
  const live = cam.status === 'running' || cam.status === 'paused';
  const [reliableMs, setReliableMs] = useState(0);
  const [missingMs, setMissingMs] = useState(0);
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = lastTick.current === null ? 0 : now - lastTick.current;
      lastTick.current = now;
      const s = engine.getSnapshot();
      if (s.handDetected && s.detectScore >= 0.7) {
        setReliableMs((v) => v + dt);
        setMissingMs(0);
      } else {
        setReliableMs(0);
        setMissingMs((v) => v + dt);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  let message: ReactNode;
  let tone: 'ok' | 'warn' | 'muted' = 'muted';
  if (!live) {
    message = 'The camera is off, so tracking cannot be checked. You can continue and use touch controls.';
  } else if (reliableMs >= 1500) {
    message = 'Hand detected reliably.';
    tone = 'ok';
  } else if (cam.handDetected) {
    message = 'Hand detected. Hold still for a moment…';
    tone = 'muted';
  } else if (missingMs > 6000) {
    message = 'Still no hand. Try more light (face a window or lamp), keep your hand fully inside the frame, palm toward the camera, about an arm’s length away.';
    tone = 'warn';
  } else {
    message = 'Hold your hand up in front of the camera, palm facing it.';
  }

  return (
    <div className="flex flex-col gap-3">
      <CameraPreview />
      <div className="flex flex-wrap items-center gap-2" role="status">
        <Badge tone={tone}>{message}</Badge>
        {cam.handDetected && cam.userHand && <Badge>{cam.userHand === 'right' ? 'Right hand' : 'Left hand'} seen</Badge>}
      </div>
      <p className="text-xs text-nx-muted">
        The pink skeleton shows what NEXUS sees. If left and right look swapped, tell me and I will adjust it. You
        can continue even if tracking is not perfect.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Stage E: assignments
function AssignStage() {
  return (
    <div>
      <p className="mb-2 text-sm text-nx-muted">
        These are NEXUS&rsquo;s built-in hand-shape and movement gestures. Pick one for each action, or disable
        an action. Custom recorded gestures are not available yet, because a few examples cannot train a reliable
        recogniser.
      </p>
      <ul className="mb-3 grid gap-1 text-xs text-nx-muted sm:grid-cols-2">
        {GESTURES.map((g) => (
          <li key={g.id}>
            <span className="text-nx-text">{g.label}</span> ({g.kind === 'pose' ? 'hold still' : 'movement'}): {g.help}
          </li>
        ))}
      </ul>
      <GestureAssignments />
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Stage F: practice
function usePractice() {
  const [hits, setHits] = useState<Record<string, boolean>>({});
  const [last, setLast] = useState<string | null>(null);
  useEffect(
    () =>
      engine.onEvent((e) => {
        const mappings = getSettings().mappings;
        const action = ACTIONS.find((a) => mappings[a.id] === e.gesture);
        const name = getGesture(e.gesture).label;
        if (!action) {
          setLast(`${name} (not assigned to an action)`);
          return;
        }
        setHits((h) => ({ ...h, [action.id]: true }));
        setLast(`${name} → ${action.label}`);
      }),
    [],
  );
  return { hits, last };
}

function TestStage() {
  const cam = useEngine();
  const settings = useSettings();
  const { hits, last } = usePractice();
  const live = cam.status === 'running' || cam.status === 'paused';
  const assigned = ACTIONS.flatMap((a) => {
    const g = settings.mappings[a.id];
    return g ? [{ action: a, gesture: g }] : [];
  });
  const done = assigned.filter((x) => hits[x.action.id]).length;

  return (
    <div className="flex flex-col gap-3">
      <CameraPreview />
      {live ? (
        <div className="grid gap-2 text-sm" aria-live="polite">
          <div className="flex items-center justify-between">
            <span>
              Seeing:{' '}
              <strong>
                {!cam.handDetected ? 'no hand' : cam.pose === 'none' ? 'hand, no gesture' : getGesture(cam.pose).label}
              </strong>
            </span>
            <span className="text-nx-muted">Confidence {cam.handDetected && cam.pose !== 'none' ? Math.round(cam.confidence * 100) : 0}%</span>
          </div>
          <ProgressBar value={cam.handDetected ? cam.holdProgress : 0} label="Hold progress" />
          <p className="text-nx-pink">{last ? `Recognised: ${last}` : 'Try a gesture. Hold poses still until the bar fills.'}</p>
        </div>
      ) : (
        <p className="text-sm text-nx-muted">The camera is off, so gestures cannot be practised. You can finish and use touch controls.</p>
      )}
      <div>
        <p className="mb-1 text-xs text-nx-muted">
          Recognised {done} of {assigned.length} assigned actions. You do not need all of them to finish.
        </p>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {assigned.map(({ action, gesture }) => (
            <li key={action.id} className={hits[action.id] ? 'text-nx-ok' : 'text-nx-muted'}>
              {hits[action.id] ? '✓' : '○'} {action.label}: {getGesture(gesture).label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Stage G: done
function DoneStage() {
  const cam = useEngine();
  const settings = useSettings();
  const live = cam.status === 'running' || cam.status === 'paused';
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm">Your gesture settings are ready.</p>
      <ul className="list-inside list-disc text-sm text-nx-muted">
        <li>Hand: {settings.hand}</li>
        <li>Camera: {live ? 'on (you can pause or stop it from the bar at the top)' : 'off (touch controls)'}</li>
        <li>You can repeat this setup any time from Settings.</li>
      </ul>
      <Button
        variant="primary"
        onClick={() => {
          updateSettings({ setupComplete: true, gestureEnabled: live });
          go('dashboard');
        }}
      >
        Finish and open dashboard
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
export function SetupWizard() {
  const [index, setIndex] = useState(0);
  const stage = STAGES[index];

  const next = () => setIndex((i) => Math.min(STAGES.length - 1, i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  // Leaving the wizard must not leave the camera running unless gestures were turned on
  // (Finish turns them on when the camera is live).
  useEffect(
    () => () => {
      if (!getSettings().gestureEnabled) engine.stop();
    },
    [],
  );

  const showNav = stage === 'hand' || stage === 'calibrate' || stage === 'assign' || stage === 'test';

  let body: ReactNode;
  switch (stage) {
    case 'welcome':
      body = <Welcome onNext={next} />;
      break;
    case 'camera':
      body = <CameraStage onNext={next} />;
      break;
    case 'hand':
      body = <HandStage />;
      break;
    case 'calibrate':
      body = <CalibrateStage />;
      break;
    case 'assign':
      body = <AssignStage />;
      break;
    case 'test':
      body = <TestStage />;
      break;
    default:
      body = <DoneStage />;
  }

  return (
    <Panel title={`Setup · ${index + 1} of ${STAGES.length} · ${TITLES[stage]}`} glow>
      <Steps index={index} />
      {body}
      {showNav && (
        <div className="mt-5 flex justify-between gap-2 border-t border-nx-line pt-4">
          <Button onClick={back}>Back</Button>
          <Button variant="primary" onClick={next}>
            {stage === 'test' ? 'Finish' : 'Next'}
          </Button>
        </div>
      )}
      {stage === 'done' && (
        <div className="mt-5 border-t border-nx-line pt-4">
          <Button onClick={back}>Back</Button>
        </div>
      )}
    </Panel>
  );
}
