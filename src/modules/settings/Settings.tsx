import { useState } from 'react';
import { Badge, Button, Panel, SettingRow as Row, selectClass } from '../../design/ui';
import { GESTURE_SPEEDS, type GestureSpeed } from '../../gestures/definitions';
import { engine, useEngine } from '../../gestures/engine';
import { setNewsPlace } from '../../lib/newsContext';
import { go } from '../../lib/useHashRoute';
import { deleteEventsDatabase } from '../calendar/eventsRepo';
import { reloadFavorites } from '../../storage/favorites';
import {
  eraseAllLocalData,
  resetSettings,
  updateSettings,
  useSettings,
  type Hand,
  type TimeFormat,
} from '../../storage/settings';
import { GestureAssignments } from './GestureAssignments';

function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 rounded-full border transition-colors disabled:opacity-50 ${
        checked ? 'border-nx-pink bg-nx-pink/30' : 'border-nx-line bg-nx-surface'
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-8' : 'left-1'}`}
      />
    </button>
  );
}

export function Settings() {
  const settings = useSettings();
  const cam = useEngine();
  const [confirmErase, setConfirmErase] = useState(false);
  const cameraOn = cam.status === 'running' || cam.status === 'paused';

  return (
    <div className="grid gap-4">
      <Panel title="Display">
        <Row label="Time format" hint="Used by the clock in the top bar.">
          <select
            aria-label="Time format"
            className={selectClass}
            value={settings.timeFormat}
            onChange={(e) => updateSettings({ timeFormat: e.target.value as TimeFormat })}
          >
            <option value="24h">24-hour</option>
            <option value="12h">12-hour</option>
          </select>
        </Row>
        <Row
          label="Reduced effects"
          hint="Turns off glow, blur and animation. Recommended for older phones or to save battery."
        >
          <Switch
            label="Reduced effects"
            checked={settings.reducedEffects}
            onChange={(v) => updateSettings({ reducedEffects: v })}
          />
        </Row>
      </Panel>

      <Panel
        title="Gestures"
        action={<Badge tone={settings.setupComplete ? 'ok' : 'warn'}>{settings.setupComplete ? 'Set up' : 'Setup needed'}</Badge>}
      >
        <p className="mb-2 text-sm text-nx-muted">
          Gestures use your camera to see your hand. Video is processed on this device and is never recorded or
          uploaded. Touch, mouse and keyboard always work.
        </p>
        <Row
          label="Camera gesture control"
          hint={
            settings.setupComplete
              ? 'Turn the camera and hand tracking on or off.'
              : 'Run the first-time setup before turning this on.'
          }
        >
          <Switch
            label="Camera gesture control"
            checked={cameraOn || cam.status === 'requesting' || cam.status === 'loading'}
            disabled={!settings.setupComplete}
            onChange={(on) => {
              if (on) {
                updateSettings({ gestureEnabled: true });
                void engine.start();
              } else {
                updateSettings({ gestureEnabled: false });
                engine.stop();
              }
            }}
          />
        </Row>
        {cam.status === 'error' && cam.error && (
          <p role="alert" className="my-2 rounded-xl border border-nx-warn/60 p-3 text-sm text-nx-warn">
            {cam.error}
          </p>
        )}
        <Row label="Show hand camera" hint="A small live window (top right) showing your hand skeleton while the camera is on. Tap it to resize.">
          <Switch
            label="Show hand camera"
            checked={settings.showHandCam}
            onChange={(v) => updateSettings({ showHandCam: v })}
          />
        </Row>
        <Row
          label="Air cursor"
          hint="Point with your index finger to move a glowing cursor over the whole app. Pinch thumb and index to click (keep pinching and move to drag). Hold up two fingers and move up or down to scroll, or to zoom the globe."
        >
          <Switch label="Air cursor" checked={settings.airCursor} onChange={(v) => updateSettings({ airCursor: v })} />
        </Row>
        <Row label="Preferred hand" hint="Gestures from the other hand are ignored.">
          <select
            aria-label="Preferred hand"
            className={selectClass}
            value={settings.hand}
            onChange={(e) => updateSettings({ hand: e.target.value as Hand })}
          >
            <option value="right">Right hand</option>
            <option value="left">Left hand</option>
            <option value="either">Either hand</option>
            <option value="both">Both hands (either can control)</option>
          </select>
        </Row>
        <Row
          label="Gesture speed"
          hint="How quickly a gesture counts. Quick is the default; Instant reacts fastest but can trigger by accident."
        >
          <select
            aria-label="Gesture speed"
            className={selectClass}
            value={settings.gestureSpeed}
            onChange={(e) => updateSettings({ gestureSpeed: e.target.value as GestureSpeed })}
          >
            {GESTURE_SPEEDS.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.label} – {sp.hint}
              </option>
            ))}
          </select>
        </Row>
        <Row
          label={`Sensitivity: ${Math.round(settings.sensitivity * 100)}%`}
          hint="Lower means fewer accidental triggers; higher reacts sooner and to smaller movements."
        >
          <input
            type="range"
            aria-label="Gesture sensitivity"
            min={0}
            max={100}
            value={Math.round(settings.sensitivity * 100)}
            onChange={(e) => updateSettings({ sensitivity: Number(e.target.value) / 100 })}
            className="w-48 accent-[var(--color-nx-pink)]"
          />
        </Row>
      </Panel>

      <Panel title="Gesture assignments">
        <p className="mb-2 text-sm text-nx-muted">
          Each gesture can trigger one action. Picking a gesture that is already used moves it to this action.
          Poses must be held still briefly before they count, which prevents accidental triggers. While the air cursor is on, pinching is the click, so the pinch and pinch-and-release gestures do not trigger actions.
        </p>
        <GestureAssignments />
      </Panel>

      <Panel title="Setup">
        <Row label="Gesture setup wizard" hint="Camera permission, hand choice, calibration and practice. Safe to repeat.">
          <Button variant="primary" onClick={() => go('setup')}>
            {settings.setupComplete ? 'Run setup again' : 'Start setup'}
          </Button>
        </Row>
      </Panel>

      <Panel title="Privacy and data">
        <p className="mb-2 text-sm text-nx-muted">
          Everything NEXUS saves stays in this browser on this device. Camera frames are analysed live and
          discarded; nothing is recorded, stored or sent anywhere. The camera is released when you stop tracking
          or leave the app.
        </p>
        <Row label="Reset settings" hint="Restores all settings and gesture assignments to defaults.">
          <Button onClick={() => resetSettings()}>Reset settings</Button>
        </Row>
        <Row label="Erase all NEXUS data" hint="Deletes everything NEXUS stored in this browser.">
          {confirmErase ? (
            <div className="flex gap-2">
              <Button
                variant="danger"
                onClick={() => {
                  engine.stop();
                  eraseAllLocalData();
                  reloadFavorites();
                  setNewsPlace(null);
                  void deleteEventsDatabase();
                  setConfirmErase(false);
                }}
              >
                Yes, erase
              </Button>
              <Button onClick={() => setConfirmErase(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmErase(true)}>
              Erase data
            </Button>
          )}
        </Row>
      </Panel>
    </div>
  );
}
