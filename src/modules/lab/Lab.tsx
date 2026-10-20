import { useState } from 'react';
import { TabPanel, Tabs, type TabItem } from '../../design/Tabs';
import { Badge, Button, Panel } from '../../design/ui';
import { useEngine } from '../../gestures/engine';
import { updateSettings, useSettings } from '../../storage/settings';
import { AirDraw } from './AirDraw';
import { TargetPractice } from './TargetPractice';

type TabId = 'draw' | 'target' | 'guide';
const TABS: ReadonlyArray<TabItem<TabId>> = [
  { id: 'draw', label: 'Air Draw' },
  { id: 'target', label: 'Target practice' },
  { id: 'guide', label: 'How it works' },
];

const MOVES = [
  ['Point (index finger up)', 'A glowing cursor follows your fingertip across the whole screen.'],
  ['Pinch (thumb + index)', 'Click. Keep pinching and move your hand to drag: draw, spin the globe, move the camera window.'],
  ['Two fingers, move up or down', 'Scroll the page. Over the globe it zooms instead.'],
  ['Open hand, swipe', 'Next / previous section. Hold an open palm to pause or resume gestures.'],
  ['Closed fist', 'Back.'],
];

function Guide() {
  const settings = useSettings();
  const cam = useEngine();
  const on = cam.status === 'running' || cam.status === 'paused';
  return (
    <Panel title="Air control">
      <p className="mb-3 text-sm text-nx-muted">
        Gestures are best for things touch cannot do: reaching a screen across the room, working with messy hands, or
        drawing in mid-air. Everything still works by touch.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {MOVES.map(([move, what]) => (
          <li key={move} className="rounded-xl border border-nx-line bg-nx-surface/60 p-3">
            <div className="font-medium">{move}</div>
            <div className="text-sm text-nx-muted">{what}</div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Badge tone={settings.airCursor ? 'ok' : 'warn'}>Air cursor {settings.airCursor ? 'on' : 'off'}</Badge>
        <Button onClick={() => updateSettings({ airCursor: !settings.airCursor })}>
          {settings.airCursor ? 'Turn air cursor off' : 'Turn air cursor on'}
        </Button>
        <Badge tone={on ? 'pink' : 'muted'}>{on ? 'Camera on' : 'Camera off: start it from the bar at the bottom'}</Badge>
      </div>
      <p className="mt-4 text-xs text-nx-muted">
        Tips: hold your hand about an arm's length away with good light. Only the middle of the camera view maps to
        the screen, so you never need to reach for the edges. If it feels slow, check the fps number under the hand
        camera and the Gesture speed setting.
      </p>
    </Panel>
  );
}

export function Lab() {
  const [tab, setTab] = useState<TabId>('draw');
  return (
    <div>
      <Tabs items={TABS} active={tab} onChange={setTab} label="Lab sections" idPrefix="lab" />
      <TabPanel idPrefix="lab" id={tab}>
        {tab === 'draw' && <AirDraw />}
        {tab === 'target' && <TargetPractice />}
        {tab === 'guide' && <Guide />}
      </TabPanel>
    </div>
  );
}
