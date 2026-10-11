/**
 * Asset tags (X-07): each fixed asset can carry a tag (AT-0001, AT-0002…) printed on a label with a
 * QR code of the tag, so a phone camera reads it back into the register's search. Tags are given in
 * order to the assets without one, oldest first, after the highest tag already used; a tag typed by
 * hand is kept as it is.
 */
export const TAG_PREFIX = 'AT-';

/** The number after the highest AT-nnnn tag in use. */
export function nextTagNumber(tags: Array<string | undefined>): number {
  return tags.reduce((max, t) => {
    const m = /^AT-(\d+)$/i.exec(String(t || '').trim());
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0) + 1;
}

export const formatTag = (n: number) => `${TAG_PREFIX}${String(n).padStart(4, '0')}`;

/** The tags to give the assets that have none (disposed ones left out), oldest first. */
export function missingTags<A extends { id: string; assetTag?: string; purchaseDate?: string; createdAt?: string; status?: string }>(assets: A[]): Array<{ id: string; assetTag: string }> {
  let next = nextTagNumber(assets.map(a => a.assetTag));
  return assets
    .filter(a => !String(a.assetTag || '').trim() && a.status !== 'disposed')
    .sort((a, b) => String(a.purchaseDate || '').localeCompare(String(b.purchaseDate || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.id.localeCompare(b.id))
    .map(a => ({ id: a.id, assetTag: formatTag(next++) }));
}

/** Whether an asset matches what was typed or scanned into the search: its tag, name or location. */
export function assetMatches(asset: { name?: string; assetTag?: string; location?: string }, text: string): boolean {
  const q = text.trim().toLocaleLowerCase();
  if (!q) return true;
  return [asset.assetTag, asset.name, asset.location].some(v => String(v || '').toLocaleLowerCase().includes(q));
}

/** Observed duplicate-tag refusal; database uniqueness is still required to cover simultaneous writers. */
export function assetTagProblem(tag: string, assets: Array<{ id: string; assetTag?: string }>, ownId: string): string | null {
  if (!tag) return null;
  const normalized = tag.trim().toLowerCase();
  return assets.some(asset => asset.id !== ownId && String(asset.assetTag || '').trim().toLowerCase() === normalized)
    ? 'That tag is already used by another asset in this workspace. Choose a different tag.'
    : null;
}
