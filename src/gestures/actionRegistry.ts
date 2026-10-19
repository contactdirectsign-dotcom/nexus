import type { ActionId } from './definitions';

/**
 * Screens register what each action means for them. The most recently registered handler
 * runs first, so a module that is on screen (for example Pulse, later) can take over
 * "next panel" from the app-wide default. Return `false` to say "not handled, ask the next one".
 */
export type ActionHandler = () => boolean | void;

const handlers = new Map<ActionId, ActionHandler[]>();

export function registerActionHandler(action: ActionId, handler: ActionHandler): () => void {
  const list = handlers.get(action) ?? [];
  list.push(handler);
  handlers.set(action, list);
  return () => {
    const current = handlers.get(action);
    if (!current) return;
    const i = current.lastIndexOf(handler);
    if (i >= 0) current.splice(i, 1);
  };
}

/** Run an action. Returns true if some handler handled it. */
export function runAction(action: ActionId): boolean {
  const list = handlers.get(action);
  if (!list) return false;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]() !== false) return true;
  }
  return false;
}
