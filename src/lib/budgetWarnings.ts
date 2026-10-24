import { toast } from 'sonner';

/**
 * EG-4: a posting over a budget is saved and the server's answer lists `budgetWarnings` (budgetGuard.ts); each one's
 * words are shown as a warning toast. Used by the posting paths (postingKit.ts) and a single entry (entryActions.ts).
 */
export function budgetWarningMessages(answer: unknown): string[] {
  const list = (answer as { budgetWarnings?: unknown } | null)?.budgetWarnings;
  if (!Array.isArray(list)) return [];
  return list.map(w => (w as { message?: unknown } | null)?.message).filter((m): m is string => typeof m === 'string' && m.length > 0);
}

export function showBudgetWarnings(answer: unknown): void {
  for (const message of budgetWarningMessages(answer)) toast.warning(message);
}
