/**
 * EG-5: the server's credit-limit refusal of an invoice save (409), handed from the posting call (postingKit) to the
 * invoice form, which shows the server's words and, for an owner or accountant, "Issue anyway" with a reason.
 * The save path in between (useEntityOperations) rewraps errors, so the refusal travels here instead.
 */
export interface CreditLimitRefusal {
  docId: string;
  /** the server's words: "Over Acme's credit limit: limit $5,000.00, owed …" */
  message: string;
  /** the server's answer: the person may issue it anyway (owner or accountant) */
  canOverride: boolean;
}

let current: CreditLimitRefusal | null = null;
const listeners = new Set<() => void>();

export function reportCreditLimitRefusal(refusal: CreditLimitRefusal | null) {
  current = refusal;
  listeners.forEach(l => l());
}

export function currentCreditLimitRefusal(): CreditLimitRefusal | null {
  return current;
}

export function subscribeCreditLimitRefusal(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
