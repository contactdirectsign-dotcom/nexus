import { SettingRow, selectClass } from '../../design/ui';
import { ACTIONS, GESTURES, assignGesture, isGestureId } from '../../gestures/definitions';
import { updateSettings, useSettings } from '../../storage/settings';

/** One dropdown per action. Shared by Settings and the setup wizard. */
export function GestureAssignments() {
  const settings = useSettings();
  return (
    <ul>
      {ACTIONS.map((a) => {
        const value = settings.mappings[a.id];
        const current = GESTURES.find((g) => g.id === value);
        return (
          <li key={a.id}>
            <SettingRow label={a.label} hint={current ? `${a.description} (${current.help})` : a.description}>
              <select
                aria-label={`Gesture for ${a.label}`}
                className={selectClass}
                value={value ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  updateSettings({
                    mappings: assignGesture(settings.mappings, a.id, isGestureId(v) ? v : null),
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
            </SettingRow>
          </li>
        );
      })}
    </ul>
  );
}
