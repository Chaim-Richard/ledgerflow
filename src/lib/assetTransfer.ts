/**
 * Moving a fixed asset (X-05): to another place (its location), and/or to other accounts (for example
 * from Vehicles to Equipment, with its accumulated depreciation). A move between accounts is one
 * balanced entry on the day: DR the new asset account, CR the old one, with the cost; DR the old
 * accumulated depreciation account, CR the new one, with the depreciation posted so far. Nothing is
 * gained or lost; a move of place only is not posted. Positive cents are debits.
 */
export interface Acc { id: string; name: string }
export interface TransferLine { accountId: string; accountName: string; amountCents: number }

export function transferLines(costCents: number, accumulatedCents: number, from: { asset?: Acc; accumulated?: Acc }, to: { asset?: Acc; accumulated?: Acc }): TransferLine[] {
  const lines: TransferLine[] = [];
  if (from.asset && to.asset && from.asset.id !== to.asset.id && costCents) {
    lines.push({ accountId: to.asset.id, accountName: to.asset.name, amountCents: costCents });
    lines.push({ accountId: from.asset.id, accountName: from.asset.name, amountCents: -costCents });
  }
  if (from.accumulated && to.accumulated && from.accumulated.id !== to.accumulated.id && accumulatedCents) {
    lines.push({ accountId: from.accumulated.id, accountName: from.accumulated.name, amountCents: accumulatedCents });
    lines.push({ accountId: to.accumulated.id, accountName: to.accumulated.name, amountCents: -accumulatedCents });
  }
  return lines;
}

/** What the move says, for the screen and the entry. */
export function describeTransfer(name: string, change: { fromLocation?: string; toLocation?: string; fromAsset?: Acc; toAsset?: Acc; fromAccumulated?: Acc; toAccumulated?: Acc }): string {
  const parts: string[] = [];
  if ((change.toLocation ?? '') !== (change.fromLocation ?? '')) parts.push(change.toLocation ? `to ${change.toLocation}` : 'out of its location');
  if (change.toAsset && change.toAsset.id !== change.fromAsset?.id) parts.push(change.fromAsset ? `from ${change.fromAsset.name} to ${change.toAsset.name}` : `into ${change.toAsset.name}`);
  if (change.toAccumulated && change.fromAccumulated && change.toAccumulated.id !== change.fromAccumulated.id) parts.push(`depreciation to ${change.toAccumulated.name}`);
  return parts.length ? `Moved ${name} ${parts.join(', ')}` : '';
}
