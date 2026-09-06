import express from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { DoubleEntryValidator } from '../../kernel/validation/DoubleEntryValidator';
import { getDb, validateWorkspaceMember, assertPeriodOpen, validateWorkspaceAccounts } from '../db/firestore';

export const inventoryRouter = express.Router();

inventoryRouter.post('/cogs', async (req, res) => {
  try {
    const { workspaceId, itemId, quantitySold, inventoryAccountId, cogsAccountId, date } = req.body;
    const user = (req as any).user;
    const db = getDb();
    
    if (!workspaceId || !itemId || !quantitySold || !inventoryAccountId || !cogsAccountId) {
      return res.status(400).json({ error: "Missing required fields (workspaceId, itemId, quantitySold, inventoryAccountId, cogsAccountId)." });
    }

    if (typeof quantitySold !== 'number' || quantitySold <= 0) {
      return res.status(400).json({ error: "quantitySold must be a positive integer." });
    }

    const txDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toLocaleDateString('en-CA');

    // 1. Validate workspace membership
    await validateWorkspaceMember(db, workspaceId, user);

    // 2. Validate period lock
    await assertPeriodOpen(db, workspaceId, txDate);

    // 3. Validate accounts exist and belong to workspace
    const accountMap = await validateWorkspaceAccounts(db, workspaceId, [inventoryAccountId, cogsAccountId]);
    const inventoryAcc = accountMap.get(inventoryAccountId)!;
    const cogsAcc = accountMap.get(cogsAccountId)!;

    // 4. Fetch the real inventory item from Firestore
    const itemDoc = await db.collection('inventory').doc(itemId).get();
    if (!itemDoc.exists) {
      return res.status(404).json({ error: `Inventory item ${itemId} not found.` });
    }
    const itemData = itemDoc.data() || {};
    if (itemData.workspaceId && itemData.workspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Security Violation: Item belongs to another workspace.' });
    }

    const unitCostCents = typeof itemData.unitCostCents === 'number' && itemData.unitCostCents > 0 ? itemData.unitCostCents : 5000;
    const totalCogsCents = Math.round(quantitySold * unitCostCents);
    const itemName = itemData.name || itemData.sku || itemId;

    const tx = {
      id: db.collection("transactions").doc().id,
      workspaceId,
      uid: user.uid,
      date: txDate,
      description: `Inventory COGS Recognition: ${itemName} (Qty: ${quantitySold})`,
      totalAmountCents: totalCogsCents,
      type: 'journal',
      status: 'posted',
      isCleared: true,
      lines: [
        {
          id: `line-1`,
          accountId: cogsAccountId,
          accountName: cogsAcc.name,
          amountCents: totalCogsCents, // Debit Expense
          description: `Recognize COGS for ${quantitySold} units of ${itemName}`
        },
        {
          id: `line-2`,
          accountId: inventoryAccountId,
          accountName: inventoryAcc.name,
          amountCents: -totalCogsCents, // Credit Asset
          description: `Reduce inventory asset for ${quantitySold} units of ${itemName}`
        }
      ]
    };

    // Double entry check
    DoubleEntryValidator.validateJournalEntry(tx as any);

    await db.runTransaction(async (t: any) => {
      const txRef = db.collection('transactions').doc(tx.id);
      t.set(txRef, { ...tx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      
      tx.lines.forEach((line: any, index: number) => {
         const eventRef = db.collection('journalEntries').doc(`${tx.id}-line-${index}`);
         t.set(eventRef, {
            id: eventRef.id,
            timestamp: new Date().toISOString(),
            accountId: line.accountId,
            amountCents: line.amountCents,
            eventType: 'ACTUAL',
            transactionId: tx.id,
            workspaceId: tx.workspaceId,
            description: line.description || tx.description
         });
      });
    });

    res.json({
      status: 'ok',
      message: 'Inventory COGS recorded successfully.',
      transactionId: tx.id,
      unitCostCents,
      totalCogsCents
    });
  } catch (e: any) {
    res.status(e.message?.includes('Unauthorized') ? 403 : 400).json({ error: e.message });
  }
});

