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

export function useEntityOperations() {
  const user = useAuthStore(s => s.user);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const analyticalPatternCache = useLedgerStore(s => s.analyticalPatternCache);

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
      const docRef = await addDoc(collection(db, path), {
        ...data,
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        createdAt: new Date().toISOString()
      });

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
      return docRef;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const updateEntity = async (path: string, id: string, updates: any, successMsg?: string) => {
    try {
      await updateDoc(doc(db, path, id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      if (successMsg) toast.success(successMsg);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${path}/${id}`);
    }
  };

  const deleteEntity = async (path: string, id: string, successMsg?: string) => {
    try {
      await deleteDoc(doc(db, path, id));
      if (successMsg) toast.success(successMsg);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
    }
  };

  return { addEntity, updateEntity, deleteEntity };
}
