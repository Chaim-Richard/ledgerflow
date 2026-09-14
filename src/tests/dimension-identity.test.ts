import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DimensionNode, Transaction, TransactionLine } from '../types';
import { 
  resolveDimensionLabel, 
  getLineDimension, 
  setLineDimension, 
  findOrCreateDimensionNode, 
  migrateWorkspaceDimensionNodes,
  updateDimensionNodeDescription,
  backfillDimensionNodesFromTransactions
} from '../lib/dimensionUtils';

describe('Stable Dimension Identity & Label Node Management', () => {
  const sampleNodes: DimensionNode[] = [
    {
      id: 'P1',
      dimensionId: 'category',
      description: 'Food & Beverage',
      aliases: ['GROCERIES', 'DINING', 'Food'],
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'P2',
      dimensionId: 'category',
      description: 'Office Equipment',
      aliases: ['HARDWARE', 'OFFICE_SUPPLIES'],
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'P3',
      dimensionId: 'category',
      description: 'Legacy Software Subscriptions',
      status: 'archived',
      createdAt: '2025-01-01T00:00:00Z'
    }
  ];

  test('1. resolveDimensionLabel resolves node IDs, descriptions, aliases, and hierarchical paths', () => {
    // 1a. Resolves Node ID -> Current Description
    assert.equal(resolveDimensionLabel(sampleNodes, 'category', 'P1'), 'Food & Beverage');

    // 1b. Resolves Description -> Current Description
    assert.equal(resolveDimensionLabel(sampleNodes, 'category', 'Food & Beverage'), 'Food & Beverage');

    // 1c. Resolves Alias -> Current Description
    assert.equal(resolveDimensionLabel(sampleNodes, 'category', 'GROCERIES'), 'Food & Beverage');

    // 1d. Resolves Hierarchical Path with Node ID prefix
    assert.equal(resolveDimensionLabel(sampleNodes, 'category', 'P1/Dairy'), 'Food & Beverage/Dairy');

    // 1e. Falls back gracefully for unknown legacy free text
    assert.equal(resolveDimensionLabel(sampleNodes, 'category', 'Unmapped Free Text'), 'Unmapped Free Text');
    assert.equal(resolveDimensionLabel(sampleNodes, 'category', 'Unassigned'), 'Unassigned');
  });

  test('2. setLineDimension stores stable node ID when value matches description or alias', () => {
    const baseLine: TransactionLine = {
      accountId: 'acc-1',
      accountName: 'Checking',
      amountCents: 1000
    };

    // 2a. Value matching alias "GROCERIES" stores node ID "P1"
    const updatedLine1 = setLineDimension(baseLine, 'category', 'GROCERIES', sampleNodes);
    assert.equal(updatedLine1.dimensions?.['category'], 'P1');
    assert.equal(updatedLine1.category, 'Food & Beverage'); // Legacy display field gets human display label

    // 2b. Value matching exact description "Food & Beverage" stores node ID "P1"
    const updatedLine2 = setLineDimension(baseLine, 'category', 'Food & Beverage', sampleNodes);
    assert.equal(updatedLine2.dimensions?.['category'], 'P1');

    // 2c. Direct node ID "P1" stays stored as "P1"
    const updatedLine3 = setLineDimension(baseLine, 'category', 'P1', sampleNodes);
    assert.equal(updatedLine3.dimensions?.['category'], 'P1');

    // 2d. Unknown free text stores as literal string
    const updatedLine4 = setLineDimension(baseLine, 'category', 'Custom Utility', sampleNodes);
    assert.equal(updatedLine4.dimensions?.['category'], 'Custom Utility');
  });

  test('3. Renaming node description updates historical reports without splitting buckets', () => {
    // Simulate historical transactions storing node ID 'P1'
    const historicalTx1: Transaction = {
      id: 'tx-1',
      uid: 'user-1',
      workspaceId: 'ws-1',
      date: '2026-01-15',
      description: 'Supermarket Purchase 1',
      totalAmountCents: 5000,
      status: 'completed',
      type: 'actual',
      createdAt: '2026-01-15T00:00:00Z',
      currency: 'USD',
      lines: [
        { accountId: 'acc-exp', accountName: 'Expense', amountCents: 5000, dimensions: { category: 'P1' } }
      ]
    };

    const historicalTx2: Transaction = {
      id: 'tx-2',
      uid: 'user-1',
      workspaceId: 'ws-1',
      date: '2026-02-15',
      description: 'Supermarket Purchase 2',
      totalAmountCents: 7500,
      status: 'completed',
      type: 'actual',
      createdAt: '2026-02-15T00:00:00Z',
      currency: 'USD',
      lines: [
        { accountId: 'acc-exp', accountName: 'Expense', amountCents: 7500, dimensions: { category: 'P1' } }
      ]
    };

    // Before rename: P1 = "Food & Beverage"
    const val1Before = getLineDimension(historicalTx1.lines[0], historicalTx1, 'category', sampleNodes);
    const val2Before = getLineDimension(historicalTx2.lines[0], historicalTx2, 'category', sampleNodes);
    assert.equal(val1Before, 'Food & Beverage');
    assert.equal(val2Before, 'Food & Beverage');

    // Bookkeeper renames node P1 from "Food & Beverage" -> "Groceries & Dining"
    const renamedNodes: DimensionNode[] = sampleNodes.map(n => {
      if (n.id === 'P1') {
        return { ...n, description: 'Groceries & Dining' };
      }
      return n;
    });

    // After rename: both historical transactions resolve to "Groceries & Dining" instantly!
    const val1After = getLineDimension(historicalTx1.lines[0], historicalTx1, 'category', renamedNodes);
    const val2After = getLineDimension(historicalTx2.lines[0], historicalTx2, 'category', renamedNodes);

    assert.equal(val1After, 'Groceries & Dining');
    assert.equal(val2After, 'Groceries & Dining');

    // Verify they group into 1 single report bucket
    const reportBuckets = new Set([val1After, val2After]);
    assert.equal(reportBuckets.size, 1);
    assert.ok(reportBuckets.has('Groceries & Dining'));
  });

  test('4. Archiving node retains append-only integrity and resolves existing transactions', () => {
    // Node P3 is archived
    const archivedNode = sampleNodes.find(n => n.id === 'P3');
    assert.equal(archivedNode?.status, 'archived');

    // Existing transaction with P3 still resolves its display label accurately
    const legacyTx: Transaction = {
      id: 'tx-old',
      uid: 'user-1',
      workspaceId: 'ws-1',
      date: '2025-06-01',
      description: 'Old Subscription',
      totalAmountCents: 2000,
      status: 'completed',
      type: 'actual',
      createdAt: '2025-06-01T00:00:00Z',
      currency: 'USD',
      lines: [
        { accountId: 'acc-exp', accountName: 'Expense', amountCents: 2000, dimensions: { category: 'P3' } }
      ]
    };

    const resolved = getLineDimension(legacyTx.lines[0], legacyTx, 'category', sampleNodes);
    assert.equal(resolved, 'Legacy Software Subscriptions');

    // Filter active nodes for selection UI excludes archived nodes
    const activeNodes = sampleNodes.filter(n => n.status !== 'archived');
    assert.equal(activeNodes.length, 2);
    assert.ok(!activeNodes.some(n => n.id === 'P3'));
  });

  test('5. findOrCreateDimensionNode mints new node when description is not found', () => {
    // Known description returns existing node
    const res1 = findOrCreateDimensionNode(sampleNodes, 'category', 'Food & Beverage');
    assert.equal(res1.isNew, false);
    assert.equal(res1.node.id, 'P1');

    // New description mints node with prefix 'C' for category (e.g. C1)
    const res2 = findOrCreateDimensionNode(sampleNodes, 'category', 'Travel & Entertainment');
    assert.equal(res2.isNew, true);
    assert.equal(res2.node.id, 'C1');
    assert.equal(res2.node.description, 'Travel & Entertainment');
    assert.equal(res2.updatedNodes.length, 4);
  });

  test('6. migrateWorkspaceDimensionNodes converts free-text dimension values to stable node IDs', () => {
    const rawTransactions: Transaction[] = [
      {
        id: 'tx-raw-1',
        uid: 'u1',
        workspaceId: 'ws-1',
        date: '2026-01-10',
        description: 'Coffee Shop',
        totalAmountCents: 1500,
        status: 'completed',
        type: 'actual',
        createdAt: '2026-01-10T00:00:00Z',
        currency: 'USD',
        lines: [
          { accountId: 'acc-1', accountName: 'Bank', amountCents: -1500, category: 'Food & Beverage' },
          { accountId: 'acc-2', accountName: 'Meals', amountCents: 1500, category: 'Food & Beverage', dimensions: { category: 'Food & Beverage' } }
        ]
      },
      {
        id: 'tx-raw-2',
        uid: 'u1',
        workspaceId: 'ws-1',
        date: '2026-01-11',
        description: 'Paper Clips',
        totalAmountCents: 500,
        status: 'completed',
        type: 'actual',
        createdAt: '2026-01-11T00:00:00Z',
        currency: 'USD',
        lines: [
          { accountId: 'acc-1', accountName: 'Bank', amountCents: -500, category: 'Office Supplies' },
          { accountId: 'acc-2', accountName: 'Supplies', amountCents: 500, category: 'Office Supplies', dimensions: { category: 'Office Supplies' } }
        ]
      }
    ];

    // Initial empty node list
    const initialNodes: DimensionNode[] = [];

    const { updatedTransactions, updatedNodes, migrationCount } = migrateWorkspaceDimensionNodes(
      rawTransactions,
      initialNodes,
      [{ id: 'category', name: 'Category' }]
    );

    assert.ok(migrationCount > 0);
    assert.equal(updatedNodes.length, 2);

    // Node created for "Food & Beverage"
    const foodNode = updatedNodes.find(n => n.description === 'Food & Beverage');
    assert.ok(foodNode);

    // Node created for "Office Supplies"
    const officeNode = updatedNodes.find(n => n.description === 'Office Supplies');
    assert.ok(officeNode);

    // Transaction lines rewritten to store node IDs
    const line1Cat = updatedTransactions[0].lines[1].dimensions?.['category'];
    const line2Cat = updatedTransactions[1].lines[1].dimensions?.['category'];

    assert.equal(line1Cat, foodNode.id);
    assert.equal(line2Cat, officeNode.id);

    // Idempotency: Running migration again results in 0 additional changes
    const secondPass = migrateWorkspaceDimensionNodes(updatedTransactions, updatedNodes, [{ id: 'category', name: 'Category' }]);
    assert.equal(secondPass.migrationCount, 0);
  });

  test('7. Alias preservation on rename keeps legacy free-text lines in the same bucket', () => {
    // Initial state: node C1 created as "Groceries/Dairy"
    let nodes: DimensionNode[] = [
      {
        id: 'C1',
        dimensionId: 'category',
        description: 'Groceries/Dairy',
        aliases: [],
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z'
      }
    ];

    // Transaction Line A: written with stable node ID 'C1'
    const lineWithNodeId: TransactionLine = {
      accountId: 'acc-exp',
      accountName: 'Food Expense',
      amountCents: 5000,
      dimensions: { category: 'C1' }
    };

    // Transaction Line B: legacy free-text line written before node registry existed
    const lineWithLegacyText: TransactionLine = {
      accountId: 'acc-exp',
      accountName: 'Food Expense',
      amountCents: 3500,
      dimensions: { category: 'Groceries/Dairy' }
    };

    // Before rename: both resolve to "Groceries/Dairy"
    const labelBefore1 = resolveDimensionLabel(nodes, 'category', lineWithNodeId.dimensions?.category);
    const labelBefore2 = resolveDimensionLabel(nodes, 'category', lineWithLegacyText.dimensions?.category);
    assert.equal(labelBefore1, 'Groceries/Dairy');
    assert.equal(labelBefore2, 'Groceries/Dairy');

    // User renames node C1 to "Food/Dairy" using updateDimensionNodeDescription
    nodes = updateDimensionNodeDescription(nodes, 'C1', 'category', 'Food/Dairy');

    // Verify C1 has updated description AND previous name pushed to aliases
    const updatedC1 = nodes.find(n => n.id === 'C1');
    assert.ok(updatedC1);
    assert.equal(updatedC1.description, 'Food/Dairy');
    assert.ok(updatedC1.aliases?.includes('Groceries/Dairy'), 'Old name must be preserved in aliases');

    // AFTER rename:
    // 1. Line storing 'C1' resolves to "Food/Dairy" via tier 1 (exact node ID match)
    const labelAfterNodeId = resolveDimensionLabel(nodes, 'category', lineWithNodeId.dimensions?.category);
    assert.equal(labelAfterNodeId, 'Food/Dairy');

    // 2. Legacy line storing 'Groceries/Dairy' resolves to "Food/Dairy" via tier 3 (alias match)
    const labelAfterLegacy = resolveDimensionLabel(nodes, 'category', lineWithLegacyText.dimensions?.category);
    assert.equal(labelAfterLegacy, 'Food/Dairy');

    // 3. Both lines bucket together into ONE bucket ['Food/Dairy'], history survives unbroken!
    const buckets = Array.from(new Set([labelAfterNodeId, labelAfterLegacy]));
    assert.deepEqual(buckets, ['Food/Dairy'], 'Must group into a single bucket rather than splitting history');
  });

  test('8. One-time backfill extracts distinct free-text paths and mints stable nodes without mutating lines', () => {
    const rawTransactions: Transaction[] = [
      {
        id: 'tx-1',
        uid: 'user-1',
        workspaceId: 'ws-1',
        date: '2026-03-01',
        description: 'Vendor A',
        type: 'actual',
        status: 'completed',
        totalAmountCents: 10000,
        currency: 'USD',
        createdAt: '2026-03-01T00:00:00Z',
        lines: [
          { accountId: 'acc-cash', accountName: 'Cash', amountCents: -10000 },
          { 
            accountId: 'acc-exp', 
            accountName: 'Operating', 
            amountCents: 10000,
            dimensions: { category: 'Marketing/Digital', project: 'Apollo' }
          }
        ]
      },
      {
        id: 'tx-2',
        uid: 'user-1',
        workspaceId: 'ws-1',
        date: '2026-03-02',
        description: 'Vendor B',
        type: 'actual',
        status: 'completed',
        totalAmountCents: 5000,
        currency: 'USD',
        createdAt: '2026-03-02T00:00:00Z',
        lines: [
          { accountId: 'acc-cash', accountName: 'Cash', amountCents: -5000 },
          { 
            accountId: 'acc-exp', 
            accountName: 'Operating', 
            amountCents: 5000,
            dimensions: { category: 'Marketing/Digital', project: 'Zeus' }
          }
        ]
      }
    ];

    const { newNodes, allNodes, createdCount } = backfillDimensionNodesFromTransactions(
      rawTransactions,
      [],
      [
        { id: 'category', name: 'Category' },
        { id: 'project', name: 'Project' }
      ]
    );

    // Mints nodes for distinct paths:
    // For category: Cash (from account fallback), Marketing (parent path step), Marketing/Digital
    // For project: Apollo, Zeus
    // Total = 5
    assert.equal(createdCount, 5);
    assert.equal(newNodes.length, 5);
    assert.equal(allNodes.length, 5);

    const mktgNode = allNodes.find(n => n.description === 'Marketing/Digital');
    assert.ok(mktgNode);
    assert.equal(mktgNode.dimensionId, 'category');

    const apolloNode = allNodes.find(n => n.description === 'Apollo');
    assert.ok(apolloNode);
    assert.equal(apolloNode.dimensionId, 'project');

    // Verify transactions lines were not mutated during pure backfill
    assert.equal(rawTransactions[0].lines[1].dimensions?.['category'], 'Marketing/Digital');
  });
});
