/**
 * Custom status workflows (BG-06): a workspace's own stages for invoices and bills, e.g. bills
 * "Received → Checked → Ready to pay", shown and changed on each record's row. A stage is the
 * team's own progress mark: it never changes the document's status, the books or what is paid.
 * Kept with the workspace's documents (kinds "stageSets" and "recordStage"), written by the server
 * only (src/server/services/stageService.ts).
 */
export type StageKind = 'invoice' | 'bill';
export const STAGE_KINDS: StageKind[] = ['invoice', 'bill'];
export const MAX_STAGES = 12;

export type StageSets = Partial<Record<StageKind, string[]>>;

export function stagesProblem(sets: unknown): string | null {
  if (!sets || typeof sets !== 'object') return 'Name the stages';
  for (const [kind, list] of Object.entries(sets as Record<string, unknown>)) {
    if (!STAGE_KINDS.includes(kind as StageKind)) return 'Stages are for invoices and bills';
    if (!Array.isArray(list) || list.length > MAX_STAGES) return `${MAX_STAGES} stages at most`;
    const seen = new Set<string>();
    for (const s of list) {
      if (typeof s !== 'string' || !s.trim() || s.length > 40) return 'Each stage needs a name (up to 40 characters)';
      const k = s.trim().toLocaleLowerCase();
      if (seen.has(k)) return `"${s.trim()}" is there twice`;
      seen.add(k);
    }
  }
  return null;
}
