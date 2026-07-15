import { storage, QueryOptions, BatchOperation } from '../storage';
import { 
  Transaction, ChartAccount, JournalEntry, Project, Budget, Vendor, Customer, 
  Invoice, Bill, InventoryItem, FixedAsset, RecurringTransaction, Employee, PayRun, 
  TaxRate, Workspace, CustomTemplate, UserProfile, BankStatementLine, AutoRule 
} from '../../types';

// The Universal Repository
// This abstracts all data access logic away from the UI and state stores.
export class DataRepository {
  
  // -- Subscriptions (Realtime) --
  
  subscribeToTransactions(workspaceId: string, callback: (data: Transaction[], hasPendingWrites?: boolean) => void) {
    return storage.subscribeToCollection<Transaction>('transactions', callback, {
      filters: [{ field: 'workspaceId', operator: '==', value: workspaceId }],
      orderBy: [{ field: 'date', direction: 'desc' }],
      limit: 1000
    });
  }

  subscribeToAccounts(workspaceId: string, callback: (data: ChartAccount[], hasPendingWrites?: boolean) => void) {
    return storage.subscribeToCollection<ChartAccount>('chartAccounts', callback, {
      filters: [{ field: 'workspaceId', operator: '==', value: workspaceId }]
    });
  }

  subscribeToCollection<T>(collectionName: string, workspaceId: string | null, callback: (data: T[], hasPendingWrites?: boolean) => void) {
    const options: QueryOptions = workspaceId 
      ? { filters: [{ field: 'workspaceId', operator: '==', value: workspaceId }] } 
      : {};
    return storage.subscribeToCollection<T>(collectionName, callback, options);
  }

  // -- CRUD Operations --

  async getDoc<T>(collectionName: string, id: string): Promise<T | null> {
    return storage.getDoc<T>(collectionName, id);
  }

  async getDocs<T>(collectionName: string, options?: QueryOptions): Promise<T[]> {
    return storage.getDocs<T>(collectionName, options);
  }

  async createDoc<T>(collectionName: string, data: any, id?: string): Promise<string> {
    return storage.createDoc<T>(collectionName, data, id);
  }

  async updateDoc(collectionName: string, id: string, data: any): Promise<void> {
    return storage.updateDoc(collectionName, id, data);
  }

  async deleteDoc(collectionName: string, id: string): Promise<void> {
    return storage.deleteDoc(collectionName, id);
  }

  // -- Advanced / Batches --

  async executeBatch(operations: BatchOperation[]): Promise<void> {
    return storage.executeBatch(operations);
  }
}

// Singleton Instance
export const repository = new DataRepository();
