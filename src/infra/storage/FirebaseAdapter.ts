import { db } from '../../firebase';
import { 
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, 
  onSnapshot, query, where, writeBatch, DocumentData, QuerySnapshot, DocumentSnapshot,
  orderBy, limit
} from 'firebase/firestore';
import { DatabaseAdapter, QueryFilter, BatchOperation, QueryOptions } from '../../services/storage/types';

export class FirebaseAdapter implements DatabaseAdapter {
  async getDoc<T>(collectionPath: string, id: string): Promise<T | null> {
    const docRef = doc(db, collectionPath, id);
    const snap = await getDoc(docRef);
    return snap.exists() ? { id: snap.id, ...(snap.data() as object) } as T : null;
  }

  private buildQuery(collectionPath: string, options?: QueryOptions) {
    let q: any = collection(db, collectionPath);
    if (options) {
      if (options.filters) {
        for (const filter of options.filters) {
          q = query(q, where(filter.field, filter.operator as any, filter.value));
        }
      }
      if (options.orderBy) {
        for (const order of options.orderBy) {
          q = query(q, orderBy(order.field, order.direction || 'asc'));
        }
      }
      if (options.limit) {
        q = query(q, limit(options.limit));
      }
    }
    return q;
  }

  async getDocs<T>(collectionPath: string, options?: QueryOptions): Promise<T[]> {
    const q = this.buildQuery(collectionPath, options);
    const snap = await getDocs(q);
    return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as object) } as T));
  }

  async createDoc<T>(collectionPath: string, data: any, id?: string): Promise<string> {
    if (id) {
      await setDoc(doc(db, collectionPath, id), data);
      return id;
    } else {
      const docRef = await addDoc(collection(db, collectionPath), data);
      return docRef.id;
    }
  }

  async updateDoc(collectionPath: string, id: string, data: any): Promise<void> {
    await updateDoc(doc(db, collectionPath, id), data);
  }

  async deleteDoc(collectionPath: string, id: string): Promise<void> {
    await deleteDoc(doc(db, collectionPath, id));
  }

  subscribeToDoc<T>(collectionPath: string, id: string, callback: (data: T | null, hasPendingWrites?: boolean) => void): () => void {
    const docRef = doc(db, collectionPath, id);
    return onSnapshot(docRef, (snap: DocumentSnapshot) => {
      callback(
        snap.exists() ? { id: snap.id, ...(snap.data() as object) } as T : null,
        snap.metadata.hasPendingWrites
      );
    });
  }

  subscribeToCollection<T>(collectionPath: string, callback: (data: T[], hasPendingWrites?: boolean) => void, options?: QueryOptions): () => void {
    const q = this.buildQuery(collectionPath, options);
    return onSnapshot(q, (snap: QuerySnapshot) => {
      callback(
        snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as object) } as T)),
        snap.metadata.hasPendingWrites
      );
    });
  }

  async executeBatch(operations: BatchOperation[]): Promise<void> {
    const batch = writeBatch(db);
    for (const op of operations) {
      const docRef = doc(db, op.collectionPath, op.docId);
      if (op.type === 'set') {
        batch.set(docRef, op.data!);
      } else if (op.type === 'update') {
        batch.update(docRef, op.data!);
      } else if (op.type === 'delete') {
        batch.delete(docRef);
      }
    }
    await batch.commit();
  }
}
