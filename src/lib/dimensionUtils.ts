import { TransactionLine, Transaction, DimensionDefinition, SplitAllocation, DimensionNode } from '../types';

export const DEFAULT_WORKSPACE_DIMENSIONS: DimensionDefinition[] = [
  { id: 'category', name: 'Category', systemDefault: true, sortOrder: 0 },
  { id: 'world', name: 'World / Entity', isWorld: true, sortOrder: 1 },
  { id: 'class', name: 'Class', sortOrder: 2 },
  { id: 'location', name: 'Location', sortOrder: 3 },
  { id: 'project', name: 'Project', sortOrder: 4 }
];

/**
 * Suggests the next short code for a dimension (e.g. 'P6' for 'property') based on existing nodes.
 */
export function suggestNextDimensionNodeId(dimensionId: string, nodes: DimensionNode[] | undefined): string {
  const prefix = dimensionId.substring(0, 1).toUpperCase();
  if (!nodes || nodes.length === 0) return `${prefix}1`;

  const existingIds = nodes
    .filter(n => n.dimensionId === dimensionId && n.id.startsWith(prefix))
    .map(n => parseInt(n.id.substring(1), 10))
    .filter(n => !isNaN(n));

  if (existingIds.length === 0) return `${prefix}1`;
  const max = Math.max(...existingIds);
  return `${prefix}${max + 1}`;
}

/**
 * Gets the string value of a specified dimension for a transaction line.
 * Resolution priority:
 * 1. Line-level `dimensions[dimId]`
 * 2. Legacy line fields (`class`, `location`, `project`, `department`, `category`, `accountName`)
 * 3. Line/Transaction tags formatted as `dimId:value` or `dimId/value`
 * 4. Transaction-level `dimensions[dimId]` or legacy fields
 * 5. Default fallback: 'Unassigned'
 */
export function getLineDimension(
  line: TransactionLine,
  tx: Transaction | undefined,
  dimensionId: string
): string {
  const normDim = (dimensionId || '').toLowerCase().trim();

  // 1. Check line.dimensions map
  if (line.dimensions && line.dimensions[normDim]) {
    return line.dimensions[normDim];
  }

  // 2. Legacy alias fallback on line
  if (normDim === 'class' && line.class) return line.class;
  if (normDim === 'location' && line.location) return line.location;
  if (normDim === 'project' && line.project) return line.project;
  if (normDim === 'department' && line.department) return line.department;
  if (normDim === 'category') {
    if (line.category) return line.category;
    if (line.accountName) return line.accountName;
  }

  // 3. Check line tags or tx tags for `dimension:value` format
  const allTags = [...(line.tags || []), ...(tx?.tags || [])];
  for (const tag of allTags) {
    if (!tag) continue;
    if (tag.includes(':')) {
      const [key, ...valParts] = tag.split(':');
      if (key.trim().toLowerCase() === normDim) {
        return valParts.join(':').trim();
      }
    }
  }

  // 4. Transaction-level dimensions & legacy aliases
  if (tx?.dimensions && tx.dimensions[normDim]) {
    return tx.dimensions[normDim];
  }
  if (tx) {
    if (normDim === 'project' && tx.projectId) return tx.projectId;
    if (normDim === 'class' && (tx as any).classId) return (tx as any).classId;
    if (normDim === 'location' && (tx as any).locationId) return (tx as any).locationId;
  }

  return 'Unassigned';
}

/**
 * Updates a transaction line with a dynamic dimension coordinate while keeping legacy aliases in sync.
 */
export function setLineDimension(
  line: TransactionLine,
  dimensionId: string,
  value: string
): TransactionLine {
  const normDim = dimensionId.toLowerCase().trim();
  const updatedDimensions = { ...(line.dimensions || {}), [normDim]: value };

  const updatedLine: TransactionLine = {
    ...line,
    dimensions: updatedDimensions
  };

  // Keep backward-compatible legacy fields in sync
  if (normDim === 'class') updatedLine.class = value;
  if (normDim === 'location') updatedLine.location = value;
  if (normDim === 'project') updatedLine.project = value;
  if (normDim === 'department') updatedLine.department = value;
  if (normDim === 'category') updatedLine.category = value;

  return updatedLine;
}

/**
 * Checks if a coordinate path matches or sits under a target parent path (hierarchical subtree match).
 * e.g., 'homes/maui/unit1' matches under 'homes' or 'homes/maui'.
 */
export function isPathSubtreeMatch(path: string, parentPath: string): boolean {
  if (!path || !parentPath) return false;
  const p = path.toLowerCase().trim();
  const target = parentPath.toLowerCase().trim();
  if (p === target) return true;
  return p.startsWith(target + '/');
}

/**
 * Validates split weight allocations for a line.
 * Weights across split allocations must sum to 1.0 (100%).
 */
export function validateSplitAllocations(splits?: SplitAllocation[]): { valid: boolean; sum: number; error?: string } {
  if (!splits || splits.length === 0) {
    return { valid: true, sum: 1.0 };
  }

  const sum = splits.reduce((acc, s) => acc + (s.weight || 0), 0);
  const roundedSum = Math.round(sum * 1000) / 1000; // allow small JS float precision

  if (Math.abs(roundedSum - 1.0) > 0.001) {
    return {
      valid: false,
      sum: roundedSum,
      error: `Split weights sum to ${(roundedSum * 100).toFixed(1)}%, but must total exactly 100%.`
    };
  }

  return { valid: true, sum: roundedSum };
}

/**
 * Extracts all unique hierarchical paths present in a dataset for autocomplete trie/dropdowns.
 */
export function extractUniqueDimensionPaths(
  transactions: Transaction[],
  dimensionId: string
): string[] {
  const pathSet = new Set<string>();
  
  transactions.forEach(tx => {
    tx.lines?.forEach(line => {
      const val = getLineDimension(line, tx, dimensionId);
      if (val && val !== 'Unassigned') {
        pathSet.add(val);
        // Also add parent path steps (e.g. homes/maui -> add homes)
        const parts = val.split('/');
        let current = '';
        for (let i = 0; i < parts.length - 1; i++) {
          current = current ? `${current}/${parts[i]}` : parts[i];
          if (current) pathSet.add(current);
        }
      }
    });
  });

  return Array.from(pathSet).sort();
}
