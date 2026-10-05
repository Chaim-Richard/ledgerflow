import type { DimensionNode } from '../types';
const key = (node: DimensionNode) => `${node.dimensionId}:${node.id}`;
/** Refresh confirmed labels without discarding unrelated edits in the settings form. */
export function mergeDimensionDrafts(incoming: DimensionNode[], draft: DimensionNode[], previous: DimensionNode[]): DimensionNode[] {
 const drafts = new Map(draft.map(node => [key(node), node])), originals = new Map(previous.map(node => [key(node), node]));
 const incomingKeys = new Set(incoming.map(key));
 const merged = incoming.map(node => {
  const local = drafts.get(key(node)), original = originals.get(key(node));
  if (!local) return node;
  if (!original) return local;
  return {
   ...node,
   ...(JSON.stringify(local.aliases) !== JSON.stringify(original.aliases) ? { aliases: local.aliases } : {}),
   ...(local.status !== original.status ? { status: local.status } : {}),
   ...(local.description !== original.description ? { description: local.description } : {}),
  };
 });
 return [...merged, ...draft.filter(node => !incomingKeys.has(key(node)) && !originals.has(key(node)))];
}
