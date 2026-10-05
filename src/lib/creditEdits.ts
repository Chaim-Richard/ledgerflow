/**
 * What can change on a credit note or vendor credit from its row (I-22). The number and reason
 * always; the date only while none of it was applied or refunded (moving it would split the
 * credit from its use across periods).
 */
export function creditDateEditable(credit: { status?: string; amountCents: number; remainingCents?: number }): boolean {
  return credit.status === 'open' && (credit.remainingCents ?? credit.amountCents) === credit.amountCents;
}

/** A message when another credit already has this number (numbers must not repeat). */
export function duplicateNumber(credits: { id: string; number?: string }[], id: string, number: string): string | null {
  const wanted = number.trim().toLowerCase();
  if (!wanted) return 'Enter a number';
  return credits.some(c => c.id !== id && (c.number || '').trim().toLowerCase() === wanted) ? `${number.trim()} is already used` : null;
}
