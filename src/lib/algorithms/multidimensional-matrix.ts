import { Transaction, ChartAccount } from '../../types';
import { AlgorithmDefinition } from './types';

// The Dimensional Ledger Engine (In-Memory OLAP Cube)
// Parses "dimension:path/to/node" tags to build dynamic pivot tables.
export function buildOLAPCube(transactions: Transaction[], rowDim: string, colDim: string) {
    const matrix = new Map<string, Map<string, number>>();
    const rowTotals = new Map<string, number>();
    const colTotals = new Map<string, number>();
    let grandTotal = 0;

    transactions.forEach(t => {
        t.lines?.forEach(line => {
            // Extract dimensions for this line
            const dims = new Map<string, string>();
            
            // Native dimensions
            if (line.accountName) dims.set('category', line.accountName);
            if (t.type) dims.set('type', t.type);
            
            // Tag-based dimensions (e.g., "property:house-1/unit-a", "client:acme")
            const allTags = [...(t.tags || []), ...(line.tags || [])];
            allTags.forEach(tag => {
                const parts = tag.split(':');
                if (parts.length >= 2) {
                    const dimName = parts[0].trim().toLowerCase();
                    const dimPath = parts.slice(1).join(':').trim();
                    dims.set(dimName, dimPath);
                } else {
                    dims.set('label', tag.trim());
                }
            });

            // If a dimension is missing for this line, we use "Unassigned"
            const rowValue = dims.get(rowDim) || 'Unassigned';
            const colValue = dims.get(colDim) || 'Unassigned';
            
            const amount = line.amountCents;

            // Add to matrix
            if (!matrix.has(rowValue)) matrix.set(rowValue, new Map());
            const rowMap = matrix.get(rowValue)!;
            rowMap.set(colValue, (rowMap.get(colValue) || 0) + amount);

            // Update totals
            rowTotals.set(rowValue, (rowTotals.get(rowValue) || 0) + amount);
            colTotals.set(colValue, (colTotals.get(colValue) || 0) + amount);
            grandTotal += amount;
        });
    });

    return { matrix, rowTotals, colTotals, grandTotal };
}

export const MULTIDIMENSIONAL_MATRIX: AlgorithmDefinition = {
  id: 'dimensional_ledger',
  domain: 'finance',
  name: 'Dimensional Ledger (OLAP Cube Engine)',
  description: 'Evaluates coordinates instead of categories. Groups transactions by dynamic dimensions (e.g., property vs. category) without rigid charts of accounts.',
  inputs: [
    { key: 'minVolume', label: 'Minimum Volume Filter ($)', min: 0, max: 10000, step: 100, defaultValue: 500 }
  ],
  compute: (transactions, accounts, inputs) => {
    // Process real transactions directly
    const processedTxs = transactions.map(t => {
      // If no explicit tags exist, check project, location, or class as dynamic dimensions
      if ((!t.tags || t.tags.length === 0) && (!t.lines || !t.lines.some(l => l.tags && l.tags.length > 0))) {
        const derivedTags: string[] = [];
        if (t.project || (t as any).projectId) derivedTags.push(`project:${t.project || (t as any).projectId}`);
        if ((t as any).location) derivedTags.push(`location:${(t as any).location}`);
        if ((t as any).class) derivedTags.push(`class:${(t as any).class}`);
        if (derivedTags.length > 0) {
          return { ...t, tags: derivedTags };
        }
      }
      return t;
    });

    const start = performance.now();
    
    // Pivot: Property/Dimension (Row) x Category (Col)
    const { matrix, rowTotals, colTotals } = buildOLAPCube(processedTxs, 'property', 'category');
    
    const ms = performance.now() - start;

    // Build chart data
    const chartData = [];
    for (const [property, total] of rowTotals.entries()) {
        if (property === 'Unassigned') continue;
        if (Math.abs(total) < inputs.minVolume * 100) continue;
        
        chartData.push({
            name: property,
            volume: Math.abs(total) / 100
        });
    }

    return {
      metrics: [
        { label: 'Execution Time', value: `${ms.toFixed(2)} ms` },
        { label: 'Properties Analyzed', value: rowTotals.size },
        { label: 'Categories Intersected', value: colTotals.size },
        { label: 'Dimensional Nodes', value: rowTotals.size * colTotals.size }
      ],
      charts: [
         {
             data: chartData,
             config: {
                 xKey: 'name',
                 yKeys: [
                     { key: 'volume', color: '#10b981', name: 'Total Volume ($)', type: 'bar' }
                 ]
             }
         }
      ],
      insights: [
        `Sliced ${transactions.length} transactions across 'property' and 'category' dimensions.`,
        'Transactions exist at coordinates (e.g., house-1/energy) rather than just linear categories.',
        'Supports infinite dynamic dimensions. Just tag a transaction "campaign:summer25" and pivot by it instantly.'
      ]
    };
  }
};
