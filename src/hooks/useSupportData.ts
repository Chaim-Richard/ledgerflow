import { useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../stores/useAuthStore';
import { useSupportStore } from '../stores/useSupportStore';
import { SupportTicket, SupportMessage } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';

export function useSupportData() {
  const user = useAuthStore(s => s.user);
  const userProfile = useAuthStore(s => s.userProfile);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const { setTickets, setMessages, setIsSyncing, selectedTicketId } = useSupportStore();

  const isAdmin = userProfile?.role === 'admin';

  // 1. Listen for Tickets
  useEffect(() => {
    if (!user || !currentWorkspaceId) return;

    let q;
    if (isAdmin) {
      // Admin View: All tickets
      q = query(
        collection(db, 'supportTickets'),
        orderBy('lastMessageAt', 'desc'),
        limit(200)
      );
    } else {
      // User View: Workspace tickets
      q = query(
        collection(db, 'supportTickets'),
        where('workspaceId', '==', currentWorkspaceId),
        orderBy('lastMessageAt', 'desc')
      );
    }

    setIsSyncing(true);
    const unsub = onSnapshot(q, (snap) => {
      const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket));
      setTickets(tickets);
      setIsSyncing(snap.metadata.hasPendingWrites);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'supportTickets');
      setIsSyncing(false);
    });

    return () => unsub();
  }, [user, currentWorkspaceId, isAdmin, setTickets, setIsSyncing]);

  // 2. Listen for Messages in Selected Ticket
  useEffect(() => {
    if (!selectedTicketId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'supportMessages'),
      where('ticketId', '==', selectedTicketId),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const messages = snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportMessage));
      setMessages(messages);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'supportMessages');
    });

    return () => unsub();
  }, [selectedTicketId, setMessages]);
}
