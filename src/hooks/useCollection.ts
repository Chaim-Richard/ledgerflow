import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  limit as firestoreLimit,
  orderBy,
  onSnapshot,
  getDocs,
  QueryConstraint,
  WhereFilterOp
} from '../lib/db/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../stores/useAuthStore';

export interface UseCollectionWhereFilter {
  field: string;
  op: WhereFilterOp;
  value: unknown;
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

export function useCollection<T = Record<string, unknown>>(
  collectionName: string,
  options: UseCollectionOptions = {}
): UseCollectionResult<T> {
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const targetWorkspaceId = options.workspaceId || currentWorkspaceId || 'default-workspace';
  const whereKey = JSON.stringify(options.where ?? null);
  const dateWindowKey = JSON.stringify(options.dateWindow ?? null);

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

    // Query setup and every state update run after the effect has finished its synchronous pass.
    void Promise.resolve().then(() => {
      if (!isMounted) return;
      setLoading(true);
      setError(null);

      try {
        const filters = JSON.parse(whereKey) as UseCollectionWhereFilter[] | null;
        const dateWindow = JSON.parse(dateWindowKey) as UseCollectionOptions['dateWindow'] | null;
        const colRef = collection(db, collectionName);
        const queryConstraints: QueryConstraint[] = [where('workspaceId', '==', targetWorkspaceId)];

        if (filters) {
          for (const w of filters) {
            queryConstraints.push(where(w.field, w.op, w.value));
          }
        }

        if (dateWindow) {
          const dField = dateWindow.dateField || 'date';
          if (dateWindow.start) {
            queryConstraints.push(where(dField, '>=', dateWindow.start));
          }
          if (dateWindow.end) {
            queryConstraints.push(where(dField, '<=', dateWindow.end));
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
              setError(err as Error);
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
              setError(err as Error);
              setLoading(false);
            });
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    });

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
    whereKey,
    dateWindowKey,
    reloadTrigger
  ]);

  return { data, loading, error, truncated, refetch };
}
