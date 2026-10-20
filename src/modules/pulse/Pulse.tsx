import { Badge, Button, EmptyState, Panel } from '../../design/ui';
import { newsQuery, setNewsPlace, useNewsPlace } from '../../lib/newsContext';

/** Category list is data so new categories can be added later by editing this array. */
export const PULSE_CATEGORIES = [
  'World',
  'India',
  'Politics',
  'Technology',
  'Science',
  'Space',
  'Business',
  'Environment',
  'Sports',
  'Breaking',
] as const;

export function Pulse() {
  const place = useNewsPlace();
  return (
    <Panel title="Pulse" action={<Badge tone="warn">Phase 4</Badge>}>
      <div className="mb-4 flex flex-wrap gap-2" aria-label="Planned news categories">
        {PULSE_CATEGORIES.map((c) => (
          <Badge key={c}>{c}</Badge>
        ))}
      </div>
      {place && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-nx-pink/50 p-3 text-sm" data-testid="news-context">
          <span>
            Place from World: <strong>{newsQuery(place)}</strong>. Pulse will use it as a news search once a source is connected.
          </span>
          <Button className="min-h-9 px-3 text-xs" onClick={() => setNewsPlace(null)}>Clear</Button>
        </div>
      )}
      <EmptyState title="No news source connected">
        Pulse is planned for Phase 4. It will read free RSS feeds through a scheduled GitHub job, so no API key
        is ever stored in the app. Until a real source is connected, no headlines are shown.
      </EmptyState>
    </Panel>
  );
}
