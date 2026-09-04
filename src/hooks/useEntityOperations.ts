import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { LedgerPostService } from '../services/LedgerPostService';

export function useEntityOperations() {
  const user = useAuthStore(s => s.user);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const analyticalPatternCache = useLedgerStore(s => s.analyticalPatternCache);

  /**
   * Recalculate and update durable balanceCents for a customer or vendor entity
   */
  const syncEntityBalance = async (entityType: 'customers' | 'vendors', entityId: string) => {
    if (!entityId || !currentWorkspaceId) return;
    try {
      const store = useLedgerStore.getState();
      let balanceCents = 0;

      if (entityType === 'customers') {
        const customerInvoices = store.invoices.filter(
          inv => inv.customerId === entityId && (inv.status as string) !== 'paid' && (inv.status as string) !== 'void' && (inv.status as string) !== 'rejected'
        );
        balanceCents = customerInvoices.reduce((sum, inv) => sum + (inv.amountCents || 0), 0);
      } else {
        const vendorBills = store.bills.filter(
          b => b.vendorId === entityId && (b.status as string) !== 'paid' && (b.status as string) !== 'void'
        );
        balanceCents = vendorBills.reduce((sum, b) => sum + (b.amountCents || 0), 0);
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

  const updateEntity = async (path: string, id: string, updates: any, successMsg?: string) => {
    try {
      const finalData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Post to ledger if it's an invoice or a bill
        
      if (path === 'invoices' && finalData.status === 'sent') {
        fetch(`/api/v1/invoices/${id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: currentWorkspaceId,
            toEmail: finalData.metadata?.sentTo || 'customer@example.com',
            subject: finalData.metadata?.emailSubject || `Invoice ${finalData.number}`,
            body: finalData.metadata?.emailBody || 'Please find your invoice attached.'
          })
        }).then(res => res.json()).then(data => {
          if (data.success) {
            toast.success('Invoice email sent successfully.');
            // Copy to clipboard for easy testing
            if (data.invoiceUrl) {
              navigator.clipboard.writeText(data.invoiceUrl);
              toast.info('Payment link copied to clipboard: ' + data.invoiceUrl);
            }
          } else {
            toast.error(data.error || 'Failed to send invoice email.');
          }
        }).catch(err => {
          console.error('Failed to send invoice email:', err);
          toast.error('Failed to send invoice email.');
        });
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
      } else {
        await deleteDoc(doc(db, path, id));
      }

      if (successMsg) toast.success(successMsg);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
    }
  };

  return { addEntity, updateEntity, deleteEntity };
}
