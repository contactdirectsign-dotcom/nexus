import { lazy, Suspense, useState } from 'react';
import { TabPanel, Tabs, type TabItem } from '../../design/Tabs';

const GlobeTab = lazy(() => import('./GlobeTab').then((m) => ({ default: m.GlobeTab })));
const ClockTab = lazy(() => import('./ClockTab').then((m) => ({ default: m.ClockTab })));
const CalendarTab = lazy(() => import('../calendar/CalendarTab').then((m) => ({ default: m.CalendarTab })));
const TimerTab = lazy(() => import('./TimerTab').then((m) => ({ default: m.TimerTab })));

type TabId = 'globe' | 'clock' | 'calendar' | 'timer';
const TABS: ReadonlyArray<TabItem<TabId>> = [
  { id: 'globe', label: 'Globe' },
  { id: 'clock', label: 'World clock' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'timer', label: 'Timer' },
];

export function World() {
  const [tab, setTab] = useState<TabId>('globe');
  return (
    <div>
      <Tabs items={TABS} active={tab} onChange={setTab} label="World sections" idPrefix="world" />
      <TabPanel idPrefix="world" id={tab}>
        <Suspense fallback={<p className="text-sm text-nx-muted" role="status">Loading…</p>}>
          {tab === 'globe' && <GlobeTab />}
          {tab === 'clock' && <ClockTab />}
          {tab === 'calendar' && <CalendarTab />}
          {tab === 'timer' && <TimerTab />}
        </Suspense>
      </TabPanel>
    </div>
  );
}
