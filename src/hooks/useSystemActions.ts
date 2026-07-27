import { useCallback } from 'react';
import { toast } from 'sonner';
import { db, auth } from '../firebase';
import { doc, writeBatch, collection, addDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useUIStore } from '../stores/useUIStore';
import { BUSINESS_TEMPLATES } from '../lib/businessTemplates';
import { ChartAccount } from '../types';

export function useSystemActions() {
  const user = useAuthStore(s => s.user);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const currentWorkspace = useAuthStore(s => s.workspaces.find(w => w.id === s.currentWorkspaceId));

  const handleLogout = useCallback(() => {
    localStorage.setItem('isGuest', 'false');
    localStorage.removeItem('clearbook_use_sandbox_mode');
    localStorage.removeItem('clearbook_identity_email');
    localStorage.removeItem('clearbook_identity_name');
    
    useAuthStore.getState().setUser(null);
    useLedgerStore.setState({ 
      transactions: [], 
      accounts: [], 
      journalEntries: [],
      computedAccounts: [],
      totalLedgerBalance: 0
    });
    
    signOut(auth).catch(() => {});
    toast.success('Returned to login screen');
  }, []);

  const handleApplyAITemplate = useCallback(async (customBlueprint: any) => {
    if (!user || !currentWorkspaceId || !customBlueprint) return;
    const loader = toast.loading(`Initiating AI ledger structural transformation...`);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'workspaces', currentWorkspaceId), {
        businessType: customBlueprint.id || 'ai_custom',
        analyticalTopology: customBlueprint.dashboardSchema || customBlueprint.topology
      });
      const hasTransactions = useLedgerStore.getState().transactions.length > 0;
      if (!hasTransactions) {
        const currentAccounts = useLedgerStore.getState().accounts;
        if (currentAccounts.length > 0) {
          currentAccounts.forEach(acc => {
            if (acc.id) batch.delete(doc(db, 'chartAccounts', acc.id));
          });
        }
        const accountsToMap = customBlueprint.chartOfAccounts || customBlueprint.accounts || [];
        accountsToMap.forEach((acc: any) => {
          const accRef = doc(collection(db, 'chartAccounts'));
          batch.set(accRef, {
            ...acc,
            uid: user.uid,
            workspaceId: currentWorkspaceId,
            balanceCents: 0,
            isArchived: false,
            createdAt: new Date().toISOString()
          });
        });
      } else {
        const accountsToMap = customBlueprint.chartOfAccounts || customBlueprint.accounts || [];
        accountsToMap.forEach((acc: any) => {
          const exists = useLedgerStore.getState().accounts.some((a: any) => a.name.toLowerCase() === acc.name.toLowerCase());
          if (!exists) {
            const accRef = doc(collection(db, 'chartAccounts'));
            batch.set(accRef, {
              ...acc,
              uid: user.uid,
              workspaceId: currentWorkspaceId,
              balanceCents: 0,
              isArchived: false,
              createdAt: new Date().toISOString()
            });
          }
        });
      }
      await batch.commit();
      toast.success('AI Ledger Template applied successfully.', { id: loader });
      useUIStore.getState().setAIBlueprintOpen(false);
      useUIStore.getState().setTemplateSelectorOpen(false);
      useUIStore.getState().setActiveTab('intelligence');
    } catch (error: any) {
      toast.error(`Transformation Failed: ${error.message}`, { id: loader });
    }
  }, [user, currentWorkspaceId]);

  const handleSelectTemplate = useCallback(async (templateId: string) => {
    if (!user || !currentWorkspaceId) return;
    const template = BUSINESS_TEMPLATES[templateId];
    if (!template) return;
    const loader = toast.loading(`Initiating ledger structural transformation...`);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'workspaces', currentWorkspaceId), {
        businessType: templateId,
        analyticalTopology: template.topology
      });
      const hasTransactions = useLedgerStore.getState().transactions.length > 0;
      if (!hasTransactions) {
        const currentAccounts = useLedgerStore.getState().accounts;
        if (currentAccounts.length > 0) {
          currentAccounts.forEach(acc => {
            if (acc.id) batch.delete(doc(db, 'chartAccounts', acc.id));
          });
        }
        template.accounts.forEach((acc: Partial<ChartAccount>) => {
          const accRef = doc(collection(db, 'chartAccounts'));
          batch.set(accRef, {
            ...acc,
            uid: user.uid,
            workspaceId: currentWorkspaceId,
            balanceCents: 0,
            createdAt: new Date().toISOString()
          });
        });
      } else {
        const currentAccounts = useLedgerStore.getState().accounts;
        const existingCodes = new Set(currentAccounts.map(a => a.code));
        const existingNames = new Set(currentAccounts.map(a => (a.name || '').toLowerCase().trim()));
        template.accounts.forEach((acc: Partial<ChartAccount>) => {
          if (!acc.code) return;
          const isCodeDuplicate = existingCodes.has(acc.code);
          const isNameDuplicate = acc.name ? existingNames.has(acc.name.toLowerCase().trim()) : false;
          if (!isCodeDuplicate && !isNameDuplicate) {
            const accRef = doc(collection(db, 'chartAccounts'));
            batch.set(accRef, {
              ...acc,
              uid: user.uid,
              workspaceId: currentWorkspaceId,
              balanceCents: 0,
              createdAt: new Date().toISOString()
            });
          }
        });
      }
      await batch.commit();
      useUIStore.getState().setTemplateSelectorOpen(false);
      useUIStore.getState().setActiveTab('ledger');
      toast.success(`STRUCTURE SET TO ${(template.name || 'UNKNOWN').toUpperCase()}`, { id: loader });
    } catch (e) {
      console.error("Template transformation aborted:", e);
      toast.error('SETUP FAILED', { id: loader });
    }
  }, [user, currentWorkspaceId]);

  const handleSaveCurrentTemplate = useCallback(async () => {
    if (!user || !currentWorkspaceId || !currentWorkspace) return;
    const name = window.prompt("Enter template name:", `${currentWorkspace.name} Clone`);
    if (!name) return;
    try {
      await addDoc(collection(db, 'customTemplates'), {
        name,
        industry: currentWorkspace.businessType || 'generic',
        accounts: useLedgerStore.getState().accounts.map(a => ({ code: a.code, name: a.name, type: a.type, category: a.category })),
        analyticalTopology: currentWorkspace.analyticalTopology || {},
        uid: user.uid,
        createdAt: new Date().toISOString()
      });
      toast.success('TEMPLATE SAVED');
    } catch (e) {
      toast.error('SNAPSHOT FAILED');
    }
  }, [user, currentWorkspaceId, currentWorkspace]);

  const handleCreateWorkspace = useCallback(async () => {
    if (!user) return;
    const name = window.prompt("Enter new workspace name:", "New Workspace");
    if (!name) return;
    try {
      const workspaceRef = doc(collection(db, 'workspaces'));
      const newWorkspace = {
        id: workspaceRef.id,
        uid: user.uid,
        name: name,
        type: 'business',
        currency: 'USD',
        businessType: 'generic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(workspaceRef, newWorkspace);
      useAuthStore.getState().setCurrentWorkspaceId(workspaceRef.id);
      useUIStore.getState().setTemplateSelectorOpen(true);
      toast.success(`Workspace '${name}' created! Please choose an architectural template.`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to create workspace');
    }
  }, [user]);

  return {
    handleLogout,
    handleApplyAITemplate,
    handleSelectTemplate,
    handleSaveCurrentTemplate,
    handleCreateWorkspace
  };
}
