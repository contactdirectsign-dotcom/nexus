import { useState, type ReactNode } from 'react';
import { Badge, Button, Panel } from '../../design/ui';
import {
  ACTIONS,
  GESTURES,
  assignGesture,
  isGestureId,
  type ActionId,
} from '../../gestures/definitions';
import {
  eraseAllLocalData,
  resetSettings,
  updateSettings,
  useSettings,
  type Hand,
  type TimeFormat,
} from '../../storage/settings';

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-nx-line/60 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-nx-muted">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

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

const selectClass =
  'min-h-11 rounded-xl border border-nx-line bg-nx-surface px-3 text-sm text-nx-text';

export function Settings() {
  const settings = useSettings();
  const [confirmErase, setConfirmErase] = useState(false);

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

      <Panel title="Gestures" action={<Badge tone="warn">Camera control: Phase 2</Badge>}>
        <p className="mb-2 text-sm text-nx-muted">
          Choose your preferences now. Camera hand tracking is not built yet, so these gestures do not trigger
          anything until Phase 2. Touch, mouse and keyboard always work.
        </p>
        <Row label="Camera gesture control" hint="Unavailable until the Gesture Lab (Phase 2) is built.">
          <Switch label="Camera gesture control" checked={false} disabled onChange={() => undefined} />
        </Row>
        <Row label="Preferred hand">
          <select
            aria-label="Preferred hand"
            className={selectClass}
            value={settings.hand}
            onChange={(e) => updateSettings({ hand: e.target.value as Hand })}
          >
            <option value="right">Right hand</option>
            <option value="left">Left hand</option>
            <option value="either">Either hand</option>
            <option value="both">Both hands</option>
          </select>
        </Row>
        <Row
          label={`Sensitivity: ${Math.round(settings.sensitivity * 100)}%`}
          hint="Lower means fewer accidental triggers; higher reacts to smaller movements."
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
        </p>
        <ul>
          {ACTIONS.map((a) => {
            const value = settings.mappings[a.id];
            return (
              <li key={a.id}>
                <Row label={a.label} hint={a.description}>
                  <select
                    aria-label={`Gesture for ${a.label}`}
                    className={selectClass}
                    value={value ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateSettings({
                        mappings: assignGesture(settings.mappings, a.id as ActionId, isGestureId(v) ? v : null),
                      });
                    }}
                  >
                    <option value="">Disabled</option>
                    {GESTURES.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </Row>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Setup">
        <Row label="First-time gesture setup" hint="The guided wizard arrives in Phase 2 and can be repeated from here.">
          <Button disabled>Run setup (Phase 2)</Button>
        </Row>
      </Panel>

      <Panel title="Privacy and data">
        <p className="mb-2 text-sm text-nx-muted">
          Everything NEXUS saves stays in this browser on this device. The camera is not used in this version, and
          when it is, video will be processed on your device and never recorded or uploaded.
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
                  eraseAllLocalData();
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
