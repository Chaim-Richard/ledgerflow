import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  limit as firestoreLimit,
  orderBy,
  onSnapshot,
  getDocs,
  WhereFilterOp
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../stores/useAuthStore';

export interface UseCollectionWhereFilter {
  field: string;
  op: WhereFilterOp;
  value: any;
}

export interface UseCollectionOptions {
  where?: UseCollectionWhereFilter[];
  dateWindow?: { start: string; end: string; dateField?: string };
  limit?: number;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  live?: boolean;
  workspaceId?: string;
}

export interface UseCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  truncated: boolean;
  refetch: () => void;
}

export function useCollection<T = any>(
  collectionName: string,
  options: UseCollectionOptions = {}
): UseCollectionResult<T> {
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const targetWorkspaceId = options.workspaceId || currentWorkspaceId || 'default-workspace';

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [truncated, setTruncated] = useState<boolean>(false);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);

  const refetch = useCallback(() => {
    setReloadTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    setLoading(true);
    setError(null);

    try {
      const colRef = collection(db, collectionName);
      const queryConstraints: any[] = [where('workspaceId', '==', targetWorkspaceId)];

      if (options.where) {
        for (const w of options.where) {
          queryConstraints.push(where(w.field, w.op, w.value));
        }
      }

      if (options.dateWindow) {
        const dField = options.dateWindow.dateField || 'date';
        if (options.dateWindow.start) {
          queryConstraints.push(where(dField, '>=', options.dateWindow.start));
        }
        if (options.dateWindow.end) {
          queryConstraints.push(where(dField, '<=', options.dateWindow.end));
        }
      }

      if (options.orderByField) {
        queryConstraints.push(orderBy(options.orderByField, options.orderDirection || 'asc'));
      }

      const limitVal = options.limit || 500;
      queryConstraints.push(firestoreLimit(limitVal));

      const q = query(colRef, ...queryConstraints);

      if (options.live !== false) {
        unsubscribe = onSnapshot(
          q,
          snapshot => {
            if (!isMounted) return;
            const items: T[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
            setData(items);
            setTruncated(snapshot.docs.length >= limitVal);
            setLoading(false);
          },
          err => {
            if (!isMounted) return;
            setError(err);
            setLoading(false);
          }
        );
      } else {
        getDocs(q)
          .then(snapshot => {
            if (!isMounted) return;
            const items: T[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
            setData(items);
            setTruncated(snapshot.docs.length >= limitVal);
            setLoading(false);
          })
          .catch(err => {
            if (!isMounted) return;
            setError(err);
            setLoading(false);
          });
      }
    } catch (err: any) {
      if (isMounted) {
        setError(err);
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [
    collectionName,
    targetWorkspaceId,
    options.live,
    options.limit,
    options.orderByField,
    options.orderDirection,
    JSON.stringify(options.where),
    JSON.stringify(options.dateWindow),
    reloadTrigger
  ]);

  return { data, loading, error, truncated, refetch };
}
