import { Badge, EmptyState, Panel } from '../../design/ui';

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
  return (
    <Panel title="Pulse" action={<Badge tone="warn">Phase 4</Badge>}>
      <div className="mb-4 flex flex-wrap gap-2" aria-label="Planned news categories">
        {PULSE_CATEGORIES.map((c) => (
          <Badge key={c}>{c}</Badge>
        ))}
      </div>
      <EmptyState title="No news source connected">
        Pulse is planned for Phase 4. It will read free RSS feeds through a scheduled GitHub job, so no API key
        is ever stored in the app. Until a real source is connected, no headlines are shown.
      </EmptyState>
    </Panel>
  );
}
