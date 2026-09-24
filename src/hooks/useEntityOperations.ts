import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  setDoc,
  query,
  where,
  getDocs
} from '../lib/db/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { LedgerPostService } from '../services/LedgerPostService';

import { isOpenInvoice, isOpenBill, lineAmount } from '../lib/txFilters';

export function useEntityOperations() {
  const user = useAuthStore(s => s.user);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const analyticalPatternCache = useLedgerStore(s => s.analyticalPatternCache);

  /**
   * Recalculate and update durable balanceCents for a customer or vendor entity
   * Queries authoritative Firestore data scoped to this entity rather than relying on truncated UI cache.
   */
  const syncEntityBalance = async (entityType: 'customers' | 'vendors', entityId: string) => {
    if (!entityId || !currentWorkspaceId) return;
    try {
      let balanceCents = 0;

      if (entityType === 'customers') {
        const q = query(
          collection(db, 'invoices'),
          where('workspaceId', '==', currentWorkspaceId),
          where('customerId', '==', entityId)
        );
        const snap = await getDocs(q);
        const customerInvoices = snap.docs.map(d => d.data()).filter(isOpenInvoice);
        balanceCents = customerInvoices.reduce((sum, inv) => sum + lineAmount(inv as any), 0);
      } else {
        const q = query(
          collection(db, 'bills'),
          where('workspaceId', '==', currentWorkspaceId),
          where('vendorId', '==', entityId)
        );
        const snap = await getDocs(q);
        const vendorBills = snap.docs.map(d => d.data()).filter(isOpenBill);
        balanceCents = vendorBills.reduce((sum, b) => sum + lineAmount(b as any), 0);
      }

      await updateDoc(doc(db, entityType, entityId), {
        balanceCents,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn(`[useEntityOperations] balanceCents sync deferred for ${entityType}/${entityId}`, e);
    }
  };

  const recordLearnedPattern = async (description: string, accountId: string, accountName: string) => {
    if (!user || !currentWorkspaceId || !description) return;
    const cleanDesc = description.toLowerCase().trim();
    if (cleanDesc.length < 3) return;
    
    const patternId = cleanDesc.replace(/[^a-z0-9]/g, '_');
    try {
      const patternRef = doc(db, 'rulePatterns', `${currentWorkspaceId}_${patternId}`);
      const existing = analyticalPatternCache[cleanDesc];
      
      await setDoc(patternRef, {
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        description: cleanDesc,
        accountId,
        accountName,
        count: (existing?.count || 0) + 1,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      // Feed delta learning to learnedDeltas for AI and categorization models
      const deltaId = `${currentWorkspaceId}_${patternId}`;
      const deltaRef = doc(db, 'learnedDeltas', deltaId);
      await setDoc(deltaRef, {
        id: deltaId,
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        apiKeyId: "human_web_console",
        description: cleanDesc.slice(0, 500),
        category: (accountName || "General").slice(0, 100),
        timestamp: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn("Soft learning deferred", e);
    }
  };

  const addEntity = async (path: string, data: any, successMsg?: string) => {
    if (!user || !currentWorkspaceId) return;
    try {
      const docId = doc(collection(db, path)).id;
      const finalData = {
        ...data,
        id: docId,
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        createdAt: new Date().toISOString()
      };

      if (path === 'invoices') {
        await LedgerPostService.postInvoiceLedger(docId, finalData, currentWorkspaceId, user.uid, { collection: path, docId, action: 'create', data: finalData });
        if (finalData.customerId) {
          syncEntityBalance('customers', finalData.customerId);
        }
      } else if (path === 'bills') {
        await LedgerPostService.postBillLedger(docId, finalData, currentWorkspaceId, user.uid, { collection: path, docId, action: 'create', data: finalData });
        if (finalData.vendorId) {
          syncEntityBalance('vendors', finalData.vendorId);
        }
      } else if (path === 'creditNotes') {
        await LedgerPostService.postCreditNoteLedger(docId, finalData, currentWorkspaceId, user.uid, { collection: path, docId, action: 'create', data: finalData });
      } else if (path === 'vendorCredits') {
        await LedgerPostService.postVendorCreditLedger(docId, finalData, currentWorkspaceId, user.uid, { collection: path, docId, action: 'create', data: finalData });
      } else {
        await setDoc(doc(db, path, docId), finalData);
      }

      // LEARNING: If we added something with a description and a category, learn it.
      if (data.description || data.vendorName || data.customerName) {
        const desc = data.description || data.vendorName || data.customerName;
        // Check for lines or direct category fields
        if (data.lines && data.lines.length > 0) {
          const mainLine = data.lines[0];
          if (mainLine.accountId && mainLine.accountName && mainLine.accountName !== 'Uncategorized') {
            recordLearnedPattern(desc, mainLine.accountId, mainLine.accountName);
          }
        } else if (data.categoryId && data.categoryName) {
           recordLearnedPattern(desc, data.categoryId, data.categoryName);
        }
      }

      if (successMsg) toast.success(successMsg);

      return doc(db, path, docId);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const sendInvoiceEmail = async (id: string, invoiceData: any) => {
    if (!currentWorkspaceId) return false;
    const customers = useLedgerStore.getState().customers || [];
    const customer = customers.find(c => c.id === invoiceData.customerId);
    const toEmail = invoiceData.metadata?.sentTo || customer?.email;

    if (!toEmail || toEmail.trim() === '' || toEmail === 'customer@example.com') {
      toast.error('Cannot send invoice email: Customer has no valid email address on file.');
      return false;
    }

    try {
      const res = await fetch(`/api/v1/invoices/email/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentWorkspaceId,
          toEmail,
          subject: invoiceData.metadata?.emailSubject || `Invoice ${invoiceData.number || id}`,
          body: invoiceData.metadata?.emailBody || 'Please find your invoice attached.'
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Invoice email sent successfully to ${toEmail}.`);
        if (data.invoiceUrl) {
          navigator.clipboard.writeText(data.invoiceUrl);
          toast.info('Payment link copied to clipboard: ' + data.invoiceUrl);
        }
        return true;
      } else {
        toast.error(data.error || 'Failed to send invoice email.');
        return false;
      }
    } catch (err) {
      console.error('Failed to send invoice email:', err);
      toast.error('Failed to send invoice email.');
      return false;
    }
  };

  const updateEntity = async (path: string, id: string, updates: any, successMsg?: string) => {
    try {
      const finalData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Post to ledger if it's an invoice or a bill
      if (path === 'invoices' && updates.status === 'sent') {
        const existingInvoice: any = useLedgerStore.getState().invoices.find(i => i.id === id) || {};
        const mergedData = { ...existingInvoice, ...finalData };
        if (existingInvoice?.status !== 'sent' || updates.forceSend) {
          sendInvoiceEmail(id, mergedData);
        }
      }


      if (path === 'invoices' && user && currentWorkspaceId) {
        const existingInvoice = useLedgerStore.getState().invoices.find(i => i.id === id) || {};
        const mergedData = { ...existingInvoice, ...finalData };
        await LedgerPostService.postInvoiceLedger(id, mergedData, currentWorkspaceId, user.uid, { collection: path, docId: id, action: 'update', data: finalData });
        const targetCustId = mergedData.customerId || finalData.customerId;
        if (targetCustId) {
          syncEntityBalance('customers', targetCustId);
        }
      } else if (path === 'bills' && user && currentWorkspaceId) {
        const existingBill = useLedgerStore.getState().bills.find(b => b.id === id) || {};
        const mergedData = { ...existingBill, ...finalData };
        await LedgerPostService.postBillLedger(id, mergedData, currentWorkspaceId, user.uid, { collection: path, docId: id, action: 'update', data: finalData });
        const targetVendId = mergedData.vendorId || finalData.vendorId;
        if (targetVendId) {
          syncEntityBalance('vendors', targetVendId);
        }
      } else if (path === 'creditNotes' && user && currentWorkspaceId) {
        const existing = useLedgerStore.getState().creditNotes.find(c => c.id === id) || {};
        const mergedData = { ...existing, ...finalData };
        await LedgerPostService.postCreditNoteLedger(id, mergedData, currentWorkspaceId, user.uid, { collection: path, docId: id, action: 'update', data: finalData });
      } else if (path === 'vendorCredits' && user && currentWorkspaceId) {
        const existing = useLedgerStore.getState().vendorCredits.find(v => v.id === id) || {};
        const mergedData = { ...existing, ...finalData };
        await LedgerPostService.postVendorCreditLedger(id, mergedData, currentWorkspaceId, user.uid, { collection: path, docId: id, action: 'update', data: finalData });
      } else {
        await updateDoc(doc(db, path, id), finalData);
      }

      if (successMsg) toast.success(successMsg);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${path}/${id}`);
    }
  };

  const deleteEntity = async (path: string, id: string, successMsg?: string) => {
    try {
      if (path === 'invoices' && currentWorkspaceId) {
        const existingInvoice = useLedgerStore.getState().invoices.find(i => i.id === id);
        await LedgerPostService.deletePostings(id, 'invoiceId', currentWorkspaceId, { collection: path, docId: id, action: 'delete' });
        if (existingInvoice?.customerId) {
          syncEntityBalance('customers', existingInvoice.customerId);
        }
      } else if (path === 'bills' && currentWorkspaceId) {
        const existingBill = useLedgerStore.getState().bills.find(b => b.id === id);
        await LedgerPostService.deletePostings(id, 'billId', currentWorkspaceId, { collection: path, docId: id, action: 'delete' });
        if (existingBill?.vendorId) {
          syncEntityBalance('vendors', existingBill.vendorId);
        }
      } else if (path === 'creditNotes' && currentWorkspaceId) {
        await LedgerPostService.deletePostings(id, 'creditNoteId' as any, currentWorkspaceId, { collection: path, docId: id, action: 'delete' });
      } else if (path === 'vendorCredits' && currentWorkspaceId) {
        await LedgerPostService.deletePostings(id, 'vendorCreditId' as any, currentWorkspaceId, { collection: path, docId: id, action: 'delete' });
      } else {
        await deleteDoc(doc(db, path, id));
      }

      if (successMsg) toast.success(successMsg);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
    }
  };

  return { addEntity, updateEntity, deleteEntity, sendInvoiceEmail };
}
