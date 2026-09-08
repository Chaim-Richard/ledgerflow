import { create } from 'zustand';
import { SupportTicket, SupportMessage } from '../types';

export interface SupportState {
  tickets: SupportTicket[];
  messages: SupportMessage[];
  selectedTicketId: string | null;
  isSyncing: boolean;

  setTickets: (tickets: SupportTicket[]) => void;
  setMessages: (messages: SupportMessage[]) => void;
  setSelectedTicketId: (id: string | null) => void;
  setIsSyncing: (isSyncing: boolean) => void;
}

export const useSupportStore = create<SupportState>((set) => ({
  tickets: [],
  messages: [],
  selectedTicketId: null,
  isSyncing: false,

  setTickets: (tickets) => set({ tickets }),
  setMessages: (messages) => set({ messages }),
  setSelectedTicketId: (selectedTicketId) => set({ selectedTicketId }),
  setIsSyncing: (isSyncing) => set({ isSyncing }),
}));
