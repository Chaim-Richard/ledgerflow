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

  const hasInvalidWeight = splits.some(s => typeof s.weight !== 'number' || s.weight < 0 || s.weight > 1.0);
  if (hasInvalidWeight) {
    return {
      valid: false,
      sum: splits.reduce((acc, s) => acc + (s.weight || 0), 0),
      error: 'Individual split weight allocations must be between 0% (0.0) and 100% (1.0).'
    };
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

/**
 * Deep Labeling & Multi-Dimensional Hierarchical Decomposition
 */
export interface DecomposedLabel {
  root: string;
  segments: string[];
  depth: number;
  parentPath: string | null;
  fullPath: string;
}

/**
 * Decomposes a multi-dimensional / nested label into its constituent hierarchy.
 * Supports delimiters: '/', ' > ', or ':'.
 * e.g. "Marketing / Digital / PPC" -> segments: ["Marketing", "Digital", "PPC"]
 */
export function decomposeHierarchicalLabel(label: string): DecomposedLabel {
  if (!label || typeof label !== 'string') {
    return { root: '', segments: [], depth: 0, parentPath: null, fullPath: '' };
  }

  const trimmed = label.trim();
  let segments: string[];

  if (trimmed.includes('>')) {
    segments = trimmed.split('>').map(s => s.trim()).filter(Boolean);
  } else if (trimmed.includes('/')) {
    segments = trimmed.split('/').map(s => s.trim()).filter(Boolean);
  } else if (trimmed.includes(':')) {
    segments = trimmed.split(':').map(s => s.trim()).filter(Boolean);
  } else {
    segments = [trimmed];
  }

  const root = segments[0] || '';
  const depth = segments.length;
  const parentPath = depth > 1 ? segments.slice(0, depth - 1).join('/') : null;
  const fullPath = segments.join('/');

  return { root, segments, depth, parentPath, fullPath };
}

/**
 * Matches a deep label against a target query pattern.
 * If matchAncestors is true, 'Dept/Engineering/Backend' matches a query for 'Dept/Engineering' or 'Dept'.
 */
export function matchDeepLabel(assigned: string, target: string, matchAncestors = true): boolean {
  if (!assigned || !target) return false;
  const a = assigned.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (a === t) return true;

  const aDec = decomposeHierarchicalLabel(a);
  const tDec = decomposeHierarchicalLabel(t);

  // Exact normalized path match
  if (aDec.fullPath.toLowerCase() === tDec.fullPath.toLowerCase()) return true;

  if (matchAncestors) {
    // Child matches ancestor (e.g. 'engineering/backend' matches 'engineering')
    if (aDec.fullPath.toLowerCase().startsWith(tDec.fullPath.toLowerCase() + '/')) return true;
    // Ancestor matches child if desired
    if (tDec.fullPath.toLowerCase().startsWith(aDec.fullPath.toLowerCase() + '/')) return true;
  }

  return false;
}

/**
 * Expands hierarchical deep tags so that querying on any parent tier works seamlessly.
 * e.g. ["marketing/digital/ppc", "dept:ops:warehouse"]
 * -> ["marketing", "marketing/digital", "marketing/digital/ppc", "dept:ops", "dept:ops:warehouse"]
 */
export function expandDeepLabels(labels: string[]): string[] {
  if (!labels || labels.length === 0) return [];
  const resultSet = new Set<string>();

  for (const raw of labels) {
    if (!raw || typeof raw !== 'string') continue;
    const clean = raw.trim();
    resultSet.add(clean);

    // If label uses ':', expand colon prefixes (e.g. dept:ops:warehouse -> dept:ops, dept)
    if (clean.includes(':')) {
      const parts = clean.split(':').map(p => p.trim()).filter(Boolean);
      let cumulative = '';
      for (let i = 0; i < parts.length; i++) {
        cumulative = cumulative ? `${cumulative}:${parts[i]}` : parts[i];
        resultSet.add(cumulative);
      }
    }

    // If label uses '/' or '>', expand slash paths
    const dec = decomposeHierarchicalLabel(clean);
    if (dec.depth > 1) {
      let cumulativePath = '';
      for (let i = 0; i < dec.segments.length; i++) {
        cumulativePath = cumulativePath ? `${cumulativePath}/${dec.segments[i]}` : dec.segments[i];
        resultSet.add(cumulativePath);
      }
    }
  }

  return Array.from(resultSet);
}

/**
 * Extracts deep multi-dimensional coordinates and labels from free text (memos, descriptions).
 * Looks for patterns like [Dimension:Value/SubValue] or #tag/subtag
 */
export function extractMultiDimensionalLabels(
  text: string,
  existingDimensions?: Record<string, string>,
  existingTags?: string[]
): { dimensions: Record<string, string>; tags: string[]; deepPaths: string[] } {
  const dimensions: Record<string, string> = { ...(existingDimensions || {}) };
  const tagSet = new Set<string>(existingTags || []);
  const deepPaths: string[] = [];

  if (!text) return { dimensions, tags: Array.from(tagSet), deepPaths };

  // 1. Match bracketed dimensions: [Key:Value] or [Key:Value/SubValue]
  const bracketRegex = /\[([a-zA-Z0-9_-]+)\s*[:=]\s*([^\]]+)\]/g;
  let bMatch;
  while ((bMatch = bracketRegex.exec(text)) !== null) {
    const dimKey = bMatch[1].toLowerCase().trim();
    const dimVal = bMatch[2].trim();
    dimensions[dimKey] = dimVal;
    deepPaths.push(`${dimKey}:${dimVal}`);
    tagSet.add(`${dimKey}:${dimVal}`);
  }

  // 2. Match hashtag deep paths: #project/apollo/subphase or #dept/eng
  const hashRegex = /#([a-zA-Z0-9_/: -]+)/g;
  let hMatch;
  while ((hMatch = hashRegex.exec(text)) !== null) {
    const tag = hMatch[1].trim();
    tagSet.add(tag);
    if (tag.includes('/') || tag.includes(':')) {
      deepPaths.push(tag);
    }
  }

  const expandedTags = expandDeepLabels(Array.from(tagSet));
  return { dimensions, tags: expandedTags, deepPaths };
}
