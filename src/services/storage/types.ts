export interface QueryFilter {
  field: string;
  operator: WhereFilterOp;
  value: any;
}

export interface QueryOrder {
  field: string;
  direction?: 'asc' | 'desc';
}

export interface QueryOptions {
  filters?: QueryFilter[];
  orderBy?: QueryOrder[];
  limit?: number;
}

export interface DatabaseAdapter {
  // Generic CRUD
  getDoc<T>(collectionPath: string, id: string): Promise<T | null>;
  getDocs<T>(collectionPath: string, options?: QueryOptions): Promise<T[]>;
  createDoc<T>(collectionPath: string, data: any, id?: string): Promise<string>;
  updateDoc(collectionPath: string, id: string, data: any): Promise<void>;
  deleteDoc(collectionPath: string, id: string): Promise<void>;
  
  // Realtime subscriptions
  subscribeToDoc<T>(collectionPath: string, id: string, callback: (data: T | null, hasPendingWrites?: boolean) => void): () => void;
  subscribeToCollection<T>(collectionPath: string, callback: (data: T[], hasPendingWrites?: boolean) => void, options?: QueryOptions): () => void;

  // Batch / Transactions
  executeBatch(operations: BatchOperation[]): Promise<void>;
}

export type WhereFilterOp = 
  | '<' | '<=' | '==' | '!=' | '>=' | '>'
  | 'array-contains' | 'in' | 'not-in' | 'array-contains-any';

export interface BatchOperation {
  type: 'set' | 'update' | 'delete';
  collectionPath: string;
  docId: string;
  data?: any;
}
