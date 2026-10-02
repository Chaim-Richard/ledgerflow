import { errorMessage, requestUser } from '../auth/requestUser';
import express from 'express';
import { FieldValue } from '../db/firestore';
import Decimal from 'decimal.js';
import { TransactionValidator } from '../../kernel/validation/TransactionValidator';
import { getDb, validateWorkspaceMember, assertPeriodOpen, validateWorkspaceAccounts } from '../db/firestore';
import { getLocalDateISO } from '../../lib/utils';

export const inventoryRouter = express.Router();

/**
 * Recognizes COGS for a sale. Reduces quantity on hand.
 */
inventoryRouter.post('/cogs', async (req, res) => {
  try {
    const { workspaceId, itemId, quantitySold, inventoryAccountId, cogsAccountId, date } = req.body;
    const user = requestUser(req);
    const db = getDb();
    
    if (!workspaceId || !itemId || !quantitySold || !inventoryAccountId || !cogsAccountId) {
      return res.status(400).json({ error: "Missing required fields (workspaceId, itemId, quantitySold, inventoryAccountId, cogsAccountId)." });
    }

    if (!Number.isInteger(quantitySold) || quantitySold <= 0) {
      return res.status(400).json({ error: "quantitySold must be a positive integer." });
    }

    // 1. Validate workspace membership FIRST (#82)
    const { data: wsData } = await validateWorkspaceMember(db, workspaceId, user);

    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (idempotencyKey) {
      const idempDoc = await db.collection('idempotencyKeys').doc(`${workspaceId}_inv_${idempotencyKey}`).get();
      if (idempDoc.exists) {
        return res.json(idempDoc.data()?.response);
      }
    }

    const txDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getLocalDateISO();

    // 2. Validate period lock
    await assertPeriodOpen(db, workspaceId, txDate, user.uid);

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
    
    // Fail-closed ownership check
    if (!itemData.workspaceId || itemData.workspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Security Violation: Item not found in workspace.' });
    }

    if (typeof itemData.unitCostCents !== 'number' || itemData.unitCostCents <= 0) {
      return res.status(400).json({ error: `Inventory item ${itemId} has no valid unitCostCents configured.` });
    }

    // #76 - Use Decimal for COGS precision
    const unitCostDec = new Decimal(itemData.unitCostCents);
    const totalCogsDec = unitCostDec.mul(quantitySold);
    const totalCogsCents = totalCogsDec.round().toNumber();
    
    const itemName = itemData.name || itemData.sku || itemId;

    const tx = {
      id: db.collection("transactions").doc().id,
      workspaceId,
      uid: user.uid,
      date: txDate,
      description: `Inventory COGS Recognition: ${itemName} (Qty: ${quantitySold})`,
      totalAmountCents: totalCogsCents,
      currency: 'USD',
      type: 'journal' as const,
      status: 'approved' as const,
      isCleared: true,
      createdAt: new Date().toISOString(),
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

    // Validate through canonical transaction validator (#102-R)
    const validatedTx = await TransactionValidator.validateAndPrepare(tx, {
      workspaceId,
      user: { uid: user.uid, admin: user.admin },
      wsData
    });

    const responsePayload = {
      status: 'ok',
      message: 'Inventory COGS recorded successfully.',
      transactionId: validatedTx.id,
      unitCostCents: itemData.unitCostCents,
      totalCogsCents
    };

    let resultResponse = responsePayload;

    await db.runTransaction(async (t: any) => {
      // Re-fetch item inside transaction for race-condition safety
      const itemSnap = await t.get(db.collection('inventory').doc(itemId));
      const currentItemData = itemSnap.data();
      const currentQty = typeof currentItemData?.quantityAtHand === 'number' ? currentItemData.quantityAtHand : 0;
      
      if (quantitySold > currentQty) {
        throw new Error(`Insufficient inventory stock. Requested ${quantitySold}, available ${currentQty}.`);
      }

      if (idempotencyKey) {
        const idempRef = db.collection('idempotencyKeys').doc(`${workspaceId}_inv_${idempotencyKey}`);
        const idempSnap = await t.get(idempRef);
        if (idempSnap.exists) {
          resultResponse = idempSnap.data()?.response || responsePayload;
          return;
        }
      }

      const txRef = db.collection('transactions').doc(validatedTx.id);
      t.set(txRef, { ...validatedTx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      
      // Reduce on-hand inventory quantity
      const itemRef = db.collection('inventory').doc(itemId);
      t.update(itemRef, {
        quantityAtHand: FieldValue.increment(-quantitySold),
        updatedAt: FieldValue.serverTimestamp()
      });

      if (idempotencyKey) {
        const idempRef = db.collection('idempotencyKeys').doc(`${workspaceId}_inv_${idempotencyKey}`);
        t.set(idempRef, {
          response: responsePayload,
          timestamp: new Date().toISOString(),
          workspaceId
        });
      }
    });

    res.json(resultResponse);
  } catch (e) {
    res.status(errorMessage(e).includes('Unauthorized') ? 403 : 400).json({ error: errorMessage(e) });
  }
});

/**
 * Purchases or Adjusts inventory. 
 * Implements Weighted Average Cost (WAC) logic if purchasing.
 */
inventoryRouter.post('/adjust', async (req, res) => {
  try {
    const { workspaceId, itemId, quantityChange, unitCostCents, inventoryAccountId, offsetAccountId, type, date } = req.body;
    const user = requestUser(req);
    const db = getDb();

    if (!workspaceId || !itemId || quantityChange === undefined || !inventoryAccountId || !offsetAccountId) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const { data: wsData } = await validateWorkspaceMember(db, workspaceId, user);
    const txDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getLocalDateISO();
    await assertPeriodOpen(db, workspaceId, txDate, user.uid);

    // 1. Validate accounts exist and belong to workspace
    const accountMap = await validateWorkspaceAccounts(db, workspaceId, [inventoryAccountId, offsetAccountId]);
    const inventoryAcc = accountMap.get(inventoryAccountId)!;
    const offsetAcc = accountMap.get(offsetAccountId)!;

    await db.runTransaction(async (t: any) => {
      const itemRef = db.collection('inventory').doc(itemId);
      const itemSnap = await t.get(itemRef);
      if (!itemSnap.exists) throw new Error('Item not found');
      
      const itemData = itemSnap.data()!;
      // Fail-closed ownership check
      if (!itemData.workspaceId || itemData.workspaceId !== workspaceId) {
        throw new Error('Security Violation: Item not found in workspace.');
      }

      const oldQty = new Decimal(itemData.quantityAtHand || 0);
      const newQty = oldQty.plus(quantityChange);
      
      // Negative inventory check for adjustments
      if (newQty.lt(0)) {
        throw new Error(`Adjustment would result in negative inventory. Current: ${oldQty.toNumber()}, Change: ${quantityChange}.`);
      }

      const oldWAC = new Decimal(itemData.unitCostCents || 0);
      const deltaQty = new Decimal(quantityChange);
      const newPurchasePrice = new Decimal(unitCostCents || itemData.unitCostCents || 0);

      let newWAC = oldWAC;
      if (type === 'purchase' && deltaQty.gt(0)) {
        const totalOldValue = oldQty.mul(oldWAC);
        const totalNewValue = deltaQty.mul(newPurchasePrice);
        newWAC = totalOldValue.plus(totalNewValue).div(oldQty.plus(deltaQty));
      }

      const totalAdjustmentValue = deltaQty.mul(newPurchasePrice).round().toNumber();

      const tx = {
        id: db.collection("transactions").doc().id,
        workspaceId,
        uid: user.uid,
        date: txDate,
        description: `Inventory ${type || 'Adjustment'}: ${itemData.name || itemId} (Qty Δ: ${quantityChange})`,
        totalAmountCents: Math.abs(totalAdjustmentValue),
        currency: 'USD',
        type: 'journal' as const,
        status: 'approved' as const,
        isCleared: true,
        createdAt: new Date().toISOString(),
        lines: [
          {
            id: `line-1`,
            accountId: inventoryAccountId,
            accountName: inventoryAcc.name,
            amountCents: totalAdjustmentValue,
            description: `${type === 'purchase' ? 'Purchase' : 'Adjustment'} of ${quantityChange} units`
          },
          {
            id: `line-2`,
            accountId: offsetAccountId,
            accountName: offsetAcc.name,
            amountCents: -totalAdjustmentValue,
            description: `Offset for inventory ${type || 'adjustment'}`
          }
        ]
      };

      const validatedTx = await TransactionValidator.validateAndPrepare(tx, {
        workspaceId,
        user: { uid: user.uid, admin: user.admin },
        wsData
      }, undefined, t);

      t.set(db.collection('transactions').doc(validatedTx.id), { ...validatedTx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      
      t.update(itemRef, {
        quantityAtHand: newQty.toNumber(),
        unitCostCents: newWAC.round().toNumber(),
        updatedAt: FieldValue.serverTimestamp()
      });
      
      return { newWAC: newWAC.toNumber(), newQuantity: newQty.toNumber() };
    }).then(result => {
        res.json({ status: 'ok', ...result });
    });
  } catch (e) {
    res.status(400).json({ error: errorMessage(e) });
  }
});

