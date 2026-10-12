/**
 * A-35 (tracker CC-03): a proposal — an estimate with a cover letter, sections and optional items,
 * sent as one page. This module builds that page's content and its figures; sending it (and the
 * Y-20 signing link on the customer's copy) stays with the existing estimate send path.
 *
 * Money rules: an optional item is priced and shown, but only the required items are the estimate's
 * total — the customer sees what the optional parts would add. Pure.
 */
import { formatDecimal } from './utils';

export interface ProposalItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
  /** shown as an add-on, never added to the required total */
  optional?: boolean;
}

export interface ProposalSection {
  id: string;
  title: string;
  body?: string;
  items: ProposalItem[];
}

export interface Proposal {
  estimateId: string;
  customerName?: string;
  title: string;
  coverLetter?: string;
  sections: ProposalSection[];
}

/** Why this proposal cannot be sent, in plain words, or null when it can. */
export function proposalProblem(proposal: Pick<Proposal, 'title' | 'sections'>): string | null {
  if (!String(proposal.title || '').trim()) return 'Give the proposal a title.';
  if (!proposal.sections?.length) return 'A proposal needs at least one section.';
  for (const section of proposal.sections) {
    if (!String(section.title || '').trim()) return 'Every section needs a title.';
    if (!section.items?.length) return `The section “${section.title}” has no items; write “Included” or add an item.`;
    for (const item of section.items) {
      if (!String(item.description || '').trim()) return 'Every item needs a description.';
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) return `The item “${item.description}” needs a quantity above zero.`;
    }
  }
  return null;
}

export interface ProposalTotals {
  /** what the required items come to */
  requiredCents: number;
  /** what the optional items would add */
  optionalCents: number;
  /** required + optional, for the sentence the customer sees */
  withOptionalsCents: number;
  requiredItems: number;
  optionalItems: number;
}

export function proposalTotals(sections: ProposalSection[]): ProposalTotals {
  let requiredCents = 0;
  let optionalCents = 0;
  let requiredItems = 0;
  let optionalItems = 0;
  for (const section of sections || []) {
    for (const item of section.items || []) {
      const amount = Math.round(Number(item.quantity) * Number(item.unitPriceCents));
      if (item.optional) { optionalCents += amount; optionalItems += 1; }
      else { requiredCents += amount; requiredItems += 1; }
    }
  }
  return { requiredCents, optionalCents, withOptionalsCents: requiredCents + optionalCents, requiredItems, optionalItems };
}

/** The one page as plain text: title, cover letter, then each section with its items and prices. */
export function proposalText(proposal: Proposal, currency = ''): string {
  const money = (cents: number) => `${formatDecimal(cents)}${currency ? ` ${currency}` : ''}`;
  const lines: string[] = [proposal.title];
  if (proposal.customerName) lines.push(`Prepared for ${proposal.customerName}`);
  if (proposal.coverLetter?.trim()) lines.push('', proposal.coverLetter.trim());
  for (const section of proposal.sections || []) {
    lines.push('', section.title);
    if (section.body?.trim()) lines.push(section.body.trim());
    for (const item of section.items || []) {
      const amount = Math.round(Number(item.quantity) * Number(item.unitPriceCents));
      lines.push(`${item.description}${item.optional ? ' (optional)' : ''} — ${item.quantity} × ${money(item.unitPriceCents)} = ${money(amount)}`);
    }
  }
  const totals = proposalTotals(proposal.sections);
  lines.push('', `Total: ${money(totals.requiredCents)}`);
  if (totals.optionalItems) lines.push(`Optional items would add ${money(totals.optionalCents)} (${money(totals.withOptionalsCents)} with them).`);
  return lines.join('\n');
}

/**
 * The sections a proposal starts with, taken from an estimate: one section holding its lines, all
 * required. The owner then splits it up, writes the cover letter and marks items optional.
 */
export function proposalFromEstimate(
  estimate: { id: string; customerName?: string; lines?: Array<{ description: string; quantity: number; unitPriceCents: number; amountCents?: number }> },
): Proposal {
  return {
    estimateId: estimate.id,
    ...(estimate.customerName ? { customerName: estimate.customerName } : {}),
    title: `Proposal for ${estimate.customerName || 'the customer'}`,
    coverLetter: '',
    sections: [{
      id: 'main',
      title: 'The work',
      items: (estimate.lines || []).map(l => ({
        description: l.description, quantity: l.quantity, unitPriceCents: l.unitPriceCents,
        amountCents: l.amountCents ?? Math.round(l.quantity * l.unitPriceCents),
      })),
    }],
  };
}
