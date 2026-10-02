import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Server, 
  Database, 
  AlertOctagon, 
  Terminal, 
  CheckCircle2, 
  Loader2,
  ShieldCheck,
  Building,
  RefreshCw,
  Cpu,
  Users,
  DollarSign,
  Gift,
  Sparkles,
  Zap,
  Sliders,
  Calculator,
  Wrench,
  Play,
  History
} from 'lucide-react';
import AuditLogViewer from '../admin/AuditLogViewer';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';
import { SYSTEM_GLOSSARY } from '../../config/registry';
import { BookA } from 'lucide-react';
import { auth, db } from '../../firebase';
import { collection, getDocs } from '../../lib/db/firestore';
import { Labelled } from '../ui/Labelled';



const fetchWithAuth = async (url: string, options: any = {}) => {
  const token = await auth.currentUser?.getIdToken();
  const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
  return fetch(url, { ...options, headers });
};

function withOccurrenceKeys<T>(items: T[], keyForItem: (item: T) => string) {
  const occurrences = new Map<string, number>();
  return items.map(item => {
    const contentKey = keyForItem(item);
    const occurrence = occurrences.get(contentKey) ?? 0;
    occurrences.set(contentKey, occurrence + 1);
    return { item, key: JSON.stringify([contentKey, occurrence]) };
  });
}

export default function SystemCommandCenter() {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useAuthStore(s => s.user);
  useAuthStore(s => s.userProfile);
  const lexiconOverrides = useUIStore(state => state.lexiconOverrides);
  const setLexiconOverride = useUIStore(state => state.setLexiconOverride);

  const [editingWorkspace, setEditingWorkspace] = useState<any | null>(null);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<'tier' | 'access' | 'credits' | 'rates' | 'roadmap'>('tier');
  
  // Advanced Simulation & Modeler variables
  const [simulatedQueries, setSimulatedQueries] = useState(250000);
  const [customKeyRatio, setCustomKeyRatio] = useState(30);
  const [simulatedLogs, setSimulatedLogs] = useState<any[]>([]);

  // Bulk deployment / Synchronization Engine
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkSyncProgress, setBulkSyncProgress] = useState(0);
  const [bulkSyncTotal, setBulkSyncTotal] = useState(0);
  const [bulkSyncStatusText, setBulkSyncStatusText] = useState('');
  const [showBulkSuccess, setShowBulkSuccess] = useState(false);

  // User Management Engine
  const [usersList, setUsersList] = useState<any[]>([]);
  const [, setLoadingUsers] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<'workspaces' | 'users' | 'global' | 'lexicon' | 'audit'>('workspaces');
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [userFormState, setUserFormState] = useState({
    role: 'client',
    customLimit: 0,
    computeCreditLimit: 0
  });

  const [formState, setFormState] = useState({
    plan: 'sandbox',
    concurrentUserLimit: 50,
    maxSeats: 3,
    computeCreditBalance: 100000,
    apiQuotaMonthlyLimitCents: 0,
    creditCostMultiplier: 1.0,
    quotaCentsMultiplier: 1.0,
    bypassBilling: false,
    customKeyCreditCharge: 10,
    customKeyCentsCharge: 0
  });

  const startEditing = (tenant: any) => {
    setEditingWorkspace(tenant);
    setActiveFormTab('tier'); // Reset to first tab on launch
    setFormState({
      plan: tenant.plan || 'sandbox',
      concurrentUserLimit: Number(tenant.concurrentUserLimit) || 50,
      maxSeats: Number(tenant.maxSeats) || 3,
      computeCreditBalance: tenant.computeCreditBalance !== undefined ? Number(tenant.computeCreditBalance) : 100000,
      apiQuotaMonthlyLimitCents: Number(tenant.apiQuotaMonthlyLimitCents) || 0,
      creditCostMultiplier: tenant.creditCostMultiplier !== undefined ? Number(tenant.creditCostMultiplier) : 1.0,
      quotaCentsMultiplier: tenant.quotaCentsMultiplier !== undefined ? Number(tenant.quotaCentsMultiplier) : 1.0,
      bypassBilling: tenant.bypassBilling === true,
      customKeyCreditCharge: tenant.customKeyCreditCharge !== undefined ? Number(tenant.customKeyCreditCharge) : 10,
      customKeyCentsCharge: tenant.customKeyCentsCharge !== undefined ? Number(tenant.customKeyCentsCharge) : 0
    });
  };

  const handleSaveWorkspaceLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkspace) return;
    setSavingWorkspace(true);
    try {
      const res = await fetchWithAuth(`/api/v1/admin/workspaces/${editingWorkspace.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formState)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          // Re-fetch telemetry immediately to reflect updates cleanly
          await fetchTelemetry();
          setEditingWorkspace(null);
        } else {
          throw new Error(data.message || 'Failed to update workspace policies');
        }
      } else {
         throw new Error('Administrative database returned non-success code.');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingWorkspace(false);
    }
  };

  // Bulk Apply baseline configuration to ALL workspaces sequentially
  const handleBulkApplyBaseline = async () => {
    const list = telemetry?.tenants || [];
    if (list.length === 0) return;
    setBulkSyncing(true);
    setBulkSyncProgress(0);
    setBulkSyncTotal(list.length);
    setBulkSyncStatusText('Commencing ledger re-alignment...');

    try {
      for (let i = 0; i < list.length; i++) {
        const tenant = list[i];
        setBulkSyncStatusText(`Re-deploying system multipliers to tenant: ${tenant.id}...`);
        
        const payload = {
          plan: tenant.plan || 'sandbox',
          concurrentUserLimit: Number(tenant.concurrentUserLimit) || 50,
          maxSeats: Number(tenant.maxSeats) || 3,
          computeCreditBalance: tenant.computeCreditBalance !== undefined ? Number(tenant.computeCreditBalance) : 100000,
          apiQuotaMonthlyLimitCents: Number(tenant.apiQuotaMonthlyLimitCents) || 0,
          creditCostMultiplier: Number(globalConfig.creditCostMultiplier),
          quotaCentsMultiplier: Number(globalConfig.quotaCentsMultiplier),
          bypassBilling: globalConfig.bypassBilling,
          customKeyCreditCharge: Number(globalConfig.customKeyCreditCharge),
          customKeyCentsCharge: Number(globalConfig.customKeyCentsCharge)
        };

        await fetchWithAuth(`/api/v1/admin/workspaces/${tenant.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        setBulkSyncProgress(i + 1);
      }

      setBulkSyncStatusText('Refreshing global configurations...');
      await fetchTelemetry();
      setShowBulkSuccess(true);
    } catch (error: any) {
      toast.error(`Bulk Sync Error: ${error.message}`);
    } finally {
      setBulkSyncing(false);
    }
  };

  // Trigger System Diagnostic event directly in system telemetry logs
  const handleTriggerStressEvent = (type: 'db_timeout' | 'quota_low' | 'normal_gemini') => {
    const freshLog: any = {
      timestamp: new Date().toISOString(),
      statusCode: type === 'db_timeout' ? 503 : type === 'quota_low' ? 429 : 200,
      method: type === 'normal_gemini' ? 'POST' : 'GET',
      path: type === 'normal_gemini' ? `/api/v1/workspace/gemini/summarize` : `/api/v1/transactions/ledger_audit`,
      ip: `10.244.31.${Math.floor(Math.random() * 254)}`,
      apiKeyUsed: `test_sim_ws_${Math.floor(Math.random() * 1000)}_key`,
      simulated: true
    };
    
    setSimulatedLogs(prev => [freshLog, ...prev]);
  };

  const [globalConfig, setGlobalConfig] = useState({
    creditCostMultiplier: 1.0,
    quotaCentsMultiplier: 1.0,
    bypassBilling: false,
    customKeyCreditCharge: 10,
    customKeyCentsCharge: 0,
    maxRegistrationLimit: 100,
    freeWorkspaceTxCap: 100
  });
  const [updatingGlobal, setUpdatingGlobal] = useState(false);

  const startEditingUser = (u: any) => {
    setEditingUser(u);
    setUserFormState({
      role: u.role || 'client',
      customLimit: u.customLimit || 0,
      computeCreditLimit: u.computeCreditLimit || 0
    });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingUser(true);
    try {
      const payload = {
        role: userFormState.role as 'client' | 'admin',
        customLimit: userFormState.customLimit ? Number(userFormState.customLimit) : null,
        computeCreditLimit: userFormState.computeCreditLimit ? Number(userFormState.computeCreditLimit) : null
      };

      const res = await fetchWithAuth(`/api/v1/admin/users/${editingUser.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to update user');
      }

      toast.success('User updated successfully');
      
      // Re-fetch users instantly
      await fetchUsersData();
      setEditingUser(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleSaveGlobalConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingGlobal(true);
    try {
      const res = await fetchWithAuth('/api/v1/admin/global-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(globalConfig)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          // Sync state instantly
          setGlobalConfig(data.globalAdminConfig);
        } else {
          throw new Error(data.message || 'Failed to update global pricing formulas');
        }
      } else {
        throw new Error('Server returned non-success response code.');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingGlobal(false);
    }
  };

    const fetchTelemetry = async () => {
      try {
        const workspacesSnap = await getDocs(collection(db, "workspaces"));
        const transactionsSnap = await getDocs(collection(db, "transactions"));
        const transactions = transactionsSnap.docs.map(doc => doc.data() as any);
        
        const tenants: Record<string, any> = {};
        workspacesSnap.docs.forEach(doc => {
           const data = doc.data() || {};
           tenants[doc.id] = {
               id: doc.id,
               name: data.name || "Default Workspace",
               plan: data.plan || "sandbox",
               concurrentUserLimit: data.concurrentUserLimit || 50,
               activeUserCount: data.activeUserCount || 0,
               seatCount: data.seatCount || 1,
               maxSeats: data.maxSeats || 5,
               computeCreditBalance: data.computeCreditBalance || 500,
               apiQuotaTotalCentsUsed: data.apiQuotaTotalCentsUsed || 0,
               apiQuotaMonthlyLimitCents: data.apiQuotaMonthlyLimitCents || 1000,
               creditCostMultiplier: 1.0,
               quotaCentsMultiplier: 1.0,
               bypassBilling: false,
               customKeyCreditCharge: 10,
               customKeyCentsCharge: 0,
               txCount: 0,
               requestCount: 0,
               errorCount: 0
           };
        });

        transactions.forEach(tx => {
            if (tx.workspaceId && tenants[tx.workspaceId]) {
                tenants[tx.workspaceId].txCount++;
            }
        });

        setTelemetry({
          status: 'success',
          tenants: Object.values(tenants),
          liveLogs: []
        });
      } catch {
        setTelemetry({
          status: 'success',
          tenants: [],
          liveLogs: []
        });
      } finally {
        setLoading(false);
      }
    };

    const fetchUsersData = async () => {
      setLoadingUsers(true);
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const usersData = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
        setUsersList(usersData as any);
      } catch (e) {
        console.warn('Admin users fetch error', e);
      } finally {
        setLoadingUsers(false);
      }
    };

    const fetchGlobalConfig = async () => {
      try {
        const res = await fetchWithAuth('/api/v1/admin/global-config');
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && data.globalAdminConfig) {
            setGlobalConfig(data.globalAdminConfig);
          }
        }
      } catch (e) {
        console.warn('Global billing overrides fetch bypassed:', e);
      }
    };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTelemetry();
      fetchGlobalConfig();
      fetchUsersData();
    }, 0);
    const interval = setInterval(() => {
      fetchTelemetry();
      fetchUsersData();
    }, 6000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const allLogsCombined = [...simulatedLogs, ...(telemetry?.liveLogs || [])];
  const totalErrors = allLogsCombined.filter((l: any) => l.statusCode >= 500).length;
  const liveErrors = allLogsCombined.filter((l: any) => l.statusCode >= 400);

  useAuthStore(s => s.isAdmin);



  return (
    <div className="space-y-12 max-w-[1600px] mx-auto pb-12 px-4">
      {/* Header section matching upgraded architecture */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-[var(--line)]">
        <div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest truncate mb-1">
            <Server size={12} />
            Institutional Telemetry & Control Tower
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-[var(--text)] tracking-tighter">Admin Panel</h2>
          <p className="text-[var(--muted)] font-medium text-lg mt-2 italic opacity-60">Consolidated platform health, multi-tenant matrices, live billing pipelines, and granular override dials.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] flex items-center gap-3 shadow-3xs">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <p className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest leading-none">Diagnostic Socket</p>
              <p className="text-xs font-bold text-emerald-600 uppercase mt-0.5 tracking-wider">ONLINE</p>
            </div>
          </div>
        </div>
      </div>

      {loading && !telemetry ? (
        <div className="h-96 flex items-center justify-center flex-col gap-3">
          <Loader2 className="animate-spin text-[var(--text)] opacity-40" size={32} />
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Hooking operational datastream...</span>
        </div>
      ) : !telemetry || !telemetry.tenants ? (
        <div className="h-96 flex flex-col items-center justify-center gap-4 border border-dashed border-[var(--line)] rounded-[32px]">
          <AlertOctagon size={40} className="text-rose-500 opacity-60" />
          <div className="text-center">
            <h3 className="text-sm font-black text-[var(--text)] uppercase tracking-wider">Interface Refused</h3>
            <p className="text-xs text-[var(--muted)] mt-1">Unable to construct reliable stream channel to backend metrics.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap gap-4 border-b border-[var(--line)] pb-4">
            <button
              onClick={() => setActiveMainTab('workspaces')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                activeMainTab === 'workspaces' ? "bg-[var(--brass)] text-[var(--ink)] shadow-md font-bold" : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)] hover:bg-[var(--ink)] hover:text-[var(--text)]"
              )}
            >
              <Building className="inline-block w-3.5 h-3.5 mr-2 -mt-0.5" />
              Workspaces & Tenants
            </button>
            <button
              onClick={() => setActiveMainTab('users')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                activeMainTab === 'users' ? "bg-[var(--brass)] text-[var(--ink)] shadow-md font-bold" : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)] hover:bg-[var(--ink)] hover:text-[var(--text)]"
              )}
            >
              <Users className="inline-block w-3.5 h-3.5 mr-2 -mt-0.5" />
              Deep User Matrix
            </button>
            <button
              onClick={() => setActiveMainTab('lexicon')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                activeMainTab === 'lexicon' ? "bg-[var(--brass)] text-[var(--ink)] shadow-md font-bold" : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)] hover:bg-[var(--ink)] hover:text-[var(--text)]"
              )}
            >
              <BookA className="inline-block w-3.5 h-3.5 mr-2 -mt-0.5" />
              Site Lexicon Control
            </button>
            <button
              onClick={() => setActiveMainTab('audit')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                activeMainTab === 'audit' ? "bg-[var(--brass)] text-[var(--ink)] shadow-md font-bold" : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)] hover:bg-[var(--ink)] hover:text-[var(--text)]"
              )}
            >
              <History className="inline-block w-3.5 h-3.5 mr-2 -mt-0.5" />
              Institutional Audit Trail
            </button>
          </div>

          {activeMainTab === 'audit' ? (
            <AuditLogViewer />
          ) : activeMainTab === 'lexicon' ? (
            <div className="space-y-8">
              <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[32px] shadow-3xs overflow-hidden">
                <div className="p-4 md:p-6 border-b border-[var(--line)] flex items-center justify-between bg-[var(--ink)]">
                  <div className="flex items-center gap-3">
                    <BookA size={16} className="text-[#0047AB]" />
                    <h3 className="text-[12px] font-black uppercase tracking-widest text-[var(--text)]">Global Lexicon Override</h3>
                  </div>
                </div>
                <div className="p-6 md:p-8 space-y-6">
                  <p className="text-sm text-[var(--muted)]">
                    Use this administrative panel to override any hardcoded text across the system. This allows full white-labeling and customization of the site's terminology. Changes here are applied instantly for all users.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.keys(SYSTEM_GLOSSARY).map(key => {
                        const originalVal = SYSTEM_GLOSSARY[key];
                        const currentVal = lexiconOverrides[key]?.en || originalVal.en;
                        return (
                          <div key={key} className="space-y-2 p-4 bg-[var(--ink)] rounded-[20px] border border-[var(--line)]">
                            <Labelled labelClassName="block text-xs font-bold text-slate-700 tracking-wide break-all" label={<>{key}</>}>
                              <input 
                                type="text"
                                value={currentVal}
                                onChange={e => setLexiconOverride(key, 'en', e.target.value)}
                                className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3 py-2 text-sm font-medium focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 transition-all"
                              />
                            </Labelled>
                          </div>
                        );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : activeMainTab === 'users' ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 space-y-8">
                <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[32px] shadow-3xs overflow-hidden">
                  <div className="p-4 md:p-6 border-b border-[var(--line)] flex items-center justify-between bg-[var(--ink)]">
                    <div className="flex items-center gap-3">
                      <Users size={16} className="text-[var(--muted)]" />
                      <h3 className="text-[12px] font-black uppercase tracking-widest text-[var(--text)]">Platform User Ledger</h3>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[var(--line)] bg-[var(--surface)] text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
                          <th className="py-4 px-6 font-medium">User Details</th>
                          <th className="py-4 px-6 font-medium">Role</th>
                          <th className="py-4 px-6 font-medium text-right">Custom Limit ($)</th>
                          <th className="py-4 px-6 font-medium text-right">Compute Limit (Cr)</th>
                          <th className="py-4 px-6 text-center font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ledger-line/50">
                        {usersList.map((u: any) => (
                          <tr key={u.uid} className="hover:bg-[var(--ink)]/50 transition-colors group">
                            <td className="py-4 px-6">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-[var(--text)]">{u.email || 'Unknown Email'}</span>
                                <span className="text-[10px] font-mono text-[var(--muted)]">{u.uid}</span>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <span className={cn(
                                "text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border",
                                u.role === 'admin' ? "bg-[#0047AB]/10 text-[#0047AB] border-[#0047AB]/20" : "bg-slate-100 text-slate-600 border-[var(--line)]"
                              )}>
                                {u.role || 'client'}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <span className="text-xs font-mono font-bold text-slate-700">
                                {u.customLimit ? `$${(u.customLimit / 100).toFixed(2)}` : 'System Default'}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <span className="text-xs font-mono font-bold text-slate-700">
                                {u.computeCreditLimit ? u.computeCreditLimit.toLocaleString() : 'System Default'}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <button 
                                onClick={() => startEditingUser(u)}
                                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border border-[var(--line)] bg-[var(--surface)] text-slate-600 hover:bg-[var(--ink)] transition-all opacity-50 group-hover:opacity-100"
                              >
                                Modify
                              </button>
                            </td>
                          </tr>
                        ))}
                        {usersList.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-[10px] uppercase font-bold tracking-widest text-[var(--muted)]">
                              No user records located.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Edit User Panel */}
              <div className="xl:col-span-1 space-y-6">
                <div className={cn(
                  "bg-[var(--surface)] border rounded-[32px] p-6 transition-all duration-300 shadow-xl",
                  editingUser ? "border-[#0047AB] ring-4 ring-[#0047AB]/5" : "border-[var(--line)] opacity-50 pointer-events-none grayscale"
                )}>
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--line)]">
                    <div className="w-8 h-8 rounded-lg bg-[#0047AB]/10 flex items-center justify-center">
                      <Wrench size={14} className="text-[#0047AB]" />
                    </div>
                    <div>
                      <h3 className="text-[12px] font-black uppercase tracking-widest text-[var(--text)]">Deep Profile Tuning</h3>
                      {editingUser && (
                        <div className="flex flex-col mt-1">
                          <span className="text-[11px] font-bold text-slate-700">{editingUser.email || 'Unknown Email'}</span>
                          <span className="text-[9px] font-mono text-[var(--muted)]">{editingUser.uid}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {editingUser ? (
                    <form onSubmit={handleSaveUser} className="space-y-6">
                      <div className="space-y-4">
                        <div>
                          <Labelled labelClassName="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5" label="Authority Role">
                            <select 
                              value={userFormState.role}
                              onChange={e => setUserFormState(prev => ({ ...prev, role: e.target.value }))}
                              className="w-full h-11 bg-[var(--ink)] border border-[var(--line)] rounded-xl px-4 text-xs font-bold text-[var(--text)] focus:border-[#0047AB] outline-none transition-all"
                            >
                              <option value="client">Client (Standard Access)</option>
                              <option value="admin">Admin (System Access)</option>
                            </select>
                          </Labelled>
                        </div>
                        <div>
                          <Labelled labelClassName="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5" label="Custom Monetary Limit (Cents)">
                            <input 
                              type="number"
                              value={userFormState.customLimit}
                              onChange={e => setUserFormState(prev => ({ ...prev, customLimit: Number(e.target.value) }))}
                              className="w-full h-11 bg-[var(--ink)] border border-[var(--line)] rounded-xl px-4 text-xs font-mono font-bold text-[var(--text)] focus:border-[#0047AB] outline-none transition-all"
                              placeholder="0 = Use System Default"
                            />
                          </Labelled>
                        </div>
                        <div>
                          <Labelled labelClassName="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5" label="Compute Credit Ceiling">
                            <input 
                              type="number"
                              value={userFormState.computeCreditLimit}
                              onChange={e => setUserFormState(prev => ({ ...prev, computeCreditLimit: Number(e.target.value) }))}
                              className="w-full h-11 bg-[var(--ink)] border border-[var(--line)] rounded-xl px-4 text-xs font-mono font-bold text-[var(--text)] focus:border-[#0047AB] outline-none transition-all"
                              placeholder="0 = Use System Default"
                            />
                          </Labelled>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5">
                            Quick Actions
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setUserFormState(prev => ({ ...prev, customLimit: 1000000000, computeCreditLimit: 1000000000 }))}
                              className="flex-1 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-green-100 transition-all"
                            >
                              Unlimit (God Mode)
                            </button>
                            <button
                              type="button"
                              onClick={() => setUserFormState(prev => ({ ...prev, customLimit: 1, computeCreditLimit: 1 }))}
                              className="flex-1 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-100 transition-all"
                            >
                              Restrict
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-[var(--line)] flex gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingUser(null)}
                          className="flex-1 px-4 py-3 border border-[var(--line)] rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--muted)] hover:bg-[var(--ink)] transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingUser}
                          className="flex-[2] px-4 py-3 bg-[#0047AB] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#003380] transition-all disabled:opacity-50"
                         aria-label="Action button">
                          {savingUser ? 'Syncing...' : 'Deploy Directives'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Select a user profile to override limits & roles</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main Left Side (Stats & Usage Table) */}
          <div className="xl:col-span-2 space-y-8">
            {/* Stat Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-[var(--surface)] border border-[var(--line)] p-4 md:p-8 rounded-[32px] shadow-3xs hover:border-slate-300 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 md:p-8 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-all">
                  <Database size={80} />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-slate-900 text-white rounded-[32px] flex items-center justify-center">
                    <Database size={18} />
                  </div>
                  <h4 className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Active Tenants</h4>
                </div>
                <h3 className="text-2xl md:text-4xl font-black font-mono text-[var(--text)] tracking-tight">{telemetry.tenants.length}</h3>
                <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider mt-2">Isolated workspaces in sync</p>
              </div>

              <div className="bg-[var(--surface)] border border-[var(--line)] p-4 md:p-8 rounded-[32px] shadow-3xs hover:border-slate-300 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 md:p-8 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-all">
                  <Activity size={80} />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-slate-900 text-white rounded-[32px] flex items-center justify-center">
                    <Activity size={18} />
                  </div>
                  <h4 className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Global Ledger Rows</h4>
                </div>
                <h3 className="text-2xl md:text-4xl font-black font-mono text-[var(--text)] tracking-tight">
                  {telemetry.tenants.reduce((acc: number, t: any) => acc + t.txCount, 0).toLocaleString()}
                </h3>
                <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider mt-2">Total transactional assertions</p>
              </div>

              <div className="bg-[var(--surface)] border border-[var(--line)] p-4 md:p-8 rounded-[32px] shadow-3xs hover:border-slate-300 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 md:p-8 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-all">
                  <AlertOctagon size={80} />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-rose-500/10 text-rose-600 rounded-[32px] flex items-center justify-center">
                    <AlertOctagon size={18} />
                  </div>
                  <h4 className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">API Incidents (400+)</h4>
                </div>
                <h3 className="text-2xl md:text-4xl font-black font-mono text-rose-600 tracking-tight">{totalErrors}</h3>
                <p className="text-[9px] font-bold text-rose-500 uppercase tracking-wider mt-2">Aggregated active warning nodes</p>
              </div>
            </div>

            {/* Global Pricing Overrides Panel & Bulk Updater */}
            <div className="bg-slate-900 border border-slate-800 text-white rounded-[32px] p-4 md:p-10 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 technical-grid opacity-[0.03] pointer-events-none" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-[32px] flex items-center justify-center border border-indigo-500/30">
                    <Sliders size={24} className="text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight italic">Global Baseline Billing & Multiplier Registry</h3>
                    <p className="text-[10px] text-white/40 font-bold tracking-widest uppercase mt-1">Configure standard fallback coefficients applied automatically or synced globally</p>
                  </div>
                </div>

                {/* Bulk Synchronization Trigger (Sync all users at once) */}
                <button
                  type="button"
                  disabled={bulkSyncing || telemetry.tenants.length === 0}
                  onClick={handleBulkApplyBaseline}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-md transition-all flex items-center gap-2 border border-indigo-400/30 disabled:opacity-40"
                 aria-label="Sync to All Workspaces">
                  <RefreshCw size={11} className={cn(bulkSyncing && "animate-spin")} />
                  Sync to All Workspaces
                </button>
              </div>

              {/* Bulk Alignment Progress Indicator */}
              <AnimatePresence>
                {bulkSyncing && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-[32px] space-y-3"
                  >
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-indigo-300 uppercase font-black tracking-widest text-[9px] flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin" />
                        {bulkSyncStatusText}
                      </span>
                      <span className="text-indigo-400 font-bold text-[10px]">
                        {bulkSyncProgress} / {bulkSyncTotal} ({Math.round((bulkSyncProgress / bulkSyncTotal) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${(bulkSyncProgress / bulkSyncTotal) * 100}%` }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSaveGlobalConfig} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-6 items-end">
                {/* Multiplier 1 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest ml-0.5">
                      Credit Cost Multiplier
                    </label>
                    <span className="text-[10px] font-mono text-indigo-400 font-bold">{globalConfig.creditCostMultiplier}x</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.05"
                    value={globalConfig.creditCostMultiplier}
                    onChange={(e) => setGlobalConfig(prev => ({ ...prev, creditCostMultiplier: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-[var(--surface)]/10 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <div className="flex justify-between text-[8px] text-white/30 font-bold uppercase">
                    <span>Free</span>
                    <span>Standard (1.0)</span>
                    <span>High (5.0)</span>
                  </div>
                </div>

                {/* Multiplier 2 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest ml-0.5">
                      Platform spend Multiplier
                    </label>
                    <span className="text-[10px] font-mono text-indigo-400 font-bold">{globalConfig.quotaCentsMultiplier}x</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.05"
                    value={globalConfig.quotaCentsMultiplier}
                    onChange={(e) => setGlobalConfig(prev => ({ ...prev, quotaCentsMultiplier: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-[var(--surface)]/10 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <div className="flex justify-between text-[8px] text-white/30 font-bold uppercase">
                    <span>Free Spend</span>
                    <span>1.0x</span>
                    <span>Premium (5.0)</span>
                  </div>
                </div>

                {/* Self API key credits */}
                <div className="space-y-2">
                  <Labelled labelClassName="block text-[10px] font-bold text-white/50 uppercase tracking-widest ml-0.5" label="Key Overhead Credits">
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={globalConfig.customKeyCreditCharge}
                      onChange={(e) => setGlobalConfig(prev => ({ ...prev, customKeyCreditCharge: Number(e.target.value || 0) }))}
                      className="w-full h-11 bg-[var(--surface)]/5 border border-white/10 rounded-xl px-4 text-xs font-mono font-bold text-white focus:border-[#0047AB] outline-none transition-all"
                    />
                  </Labelled>
                  <p className="text-[9px] text-white/30 uppercase font-black">standard: 10 per call</p>
                </div>

                {/* Self API key cents */}
                <div className="space-y-2">
                  <Labelled labelClassName="block text-[10px] font-bold text-white/50 uppercase tracking-widest ml-0.5" label="Key Overhead Cents">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={globalConfig.customKeyCentsCharge}
                      onChange={(e) => setGlobalConfig(prev => ({ ...prev, customKeyCentsCharge: Number(e.target.value || 0) }))}
                      className="w-full h-11 bg-[var(--surface)]/5 border border-white/10 rounded-xl px-4 text-xs font-mono font-bold text-white focus:border-[#0047AB] outline-none transition-all"
                    />
                  </Labelled>
                  <p className="text-[9px] text-white/30 uppercase font-black">standard: 0 cents</p>
                </div>

                {/* User Limit Cap */}
                <div className="space-y-2">
                  <Labelled labelClassName="block text-[10px] font-bold text-white/50 uppercase tracking-widest ml-0.5" label="User Registration Limit">
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={globalConfig.maxRegistrationLimit ?? 100}
                      onChange={(e) => setGlobalConfig(prev => ({ ...prev, maxRegistrationLimit: Number(e.target.value || 0) }))}
                      className="w-full h-11 bg-[var(--surface)]/5 border border-white/10 rounded-xl px-4 text-xs font-mono font-bold text-white focus:border-[#0047AB] outline-none transition-all"
                    />
                  </Labelled>
                  <p className="text-[9px] text-white/30 uppercase font-black">limit total users</p>
                </div>

                {/* Free Tx Cap */}
                <div className="space-y-2">
                  <Labelled labelClassName="block text-[10px] font-bold text-white/50 uppercase tracking-widest ml-0.5" label="Free Tier Tx Cap">
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={globalConfig.freeWorkspaceTxCap ?? 100}
                      onChange={(e) => setGlobalConfig(prev => ({ ...prev, freeWorkspaceTxCap: Number(e.target.value || 0) }))}
                      className="w-full h-11 bg-[var(--surface)]/5 border border-white/10 rounded-xl px-4 text-xs font-mono font-bold text-white focus:border-[#0047AB] outline-none transition-all"
                    />
                  </Labelled>
                  <p className="text-[9px] text-white/30 uppercase font-black">cap per free workspace</p>
                </div>

                {/* Submit button */}
                <div className="space-y-2">
                  <button
                    type="submit"
                    disabled={updatingGlobal}
                    className="w-full h-11 bg-[#0047AB] hover:bg-[#0047AB]/90 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
                   aria-label="Action button">
                    {updatingGlobal ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Save Baseline Pricing'
                    )}
                  </button>
                  <div className="flex items-center gap-1.5 justify-center">
                    <input 
                      type="checkbox" 
                      id="globalBypass"
                      checked={globalConfig.bypassBilling}
                      onChange={(e) => setGlobalConfig(prev => ({ ...prev, bypassBilling: e.target.checked }))}
                      className="cursor-pointer" 
                    />
                    <label htmlFor="globalBypass" className="text-[9px] font-black uppercase tracking-wider text-pink-400 cursor-pointer select-none">
                      MASTER BYPASS FREE
                    </label>
                  </div>
                </div>
              </form>
            </div>

            {/* Interactive Billing & Profit Simulator Modeler */}
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[32px] p-4 md:p-10 shadow-3xs relative overflow-hidden">
              <div className="absolute inset-0 technical-grid opacity-[0.01] pointer-events-none" />
              
              <div className="flex items-center gap-3 pb-6 border-b border-[var(--line)] mb-6">
                <div className="w-10 h-10 bg-[#0047AB]/5 text-[#0047AB] rounded-[32px] flex items-center justify-center">
                  <Calculator size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight italic">Platform Revenue & Surcharge Modeler Simulation</h3>
                  <p className="text-[10px] text-[var(--muted)] font-bold tracking-wide uppercase mt-0.5">
                    Model monetization yield based on query volume, cost multipliers, and proportion of private key users
                  </p>
                </div>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Load-Test Queries per Month</span>
                    <span className="text-xs font-mono font-black text-[#0047AB]">{simulatedQueries.toLocaleString()} / mo</span>
                  </div>
                  <input
                    type="range"
                    min="10000"
                    max="5000000"
                    step="10000"
                    value={simulatedQueries}
                    onChange={(e) => setSimulatedQueries(Number(e.target.value))}
                    className="w-full h-2 bg-slate-150 rounded-lg appearance-none cursor-pointer accent-[#0047AB]"
                  />
                  <div className="flex justify-between text-[9px] text-[var(--muted)] font-bold uppercase">
                    <span>10k / low</span>
                    <span>1M / mid</span>
                    <span>5M / high-volume</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Proportion of Custom Key Users</span>
                    <span className="text-xs font-mono font-black text-indigo-650">{customKeyRatio}% of tenants</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={customKeyRatio}
                    onChange={(e) => setCustomKeyRatio(Number(e.target.value))}
                    className="w-full h-2 bg-slate-150 rounded-lg appearance-none cursor-pointer accent-[#0047AB]"
                  />
                  <div className="flex justify-between text-[9px] text-[var(--muted)] font-bold uppercase">
                    <span>0% (All System Paid)</span>
                    <span>50% (Surcharge Hybrid)</span>
                    <span>100% (Pure key Surcharge)</span>
                  </div>
                </div>
              </div>

              {/* Calculations Matrix results */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 bg-[var(--ink)] rounded-[32px] border border-[var(--line)]">
                {/* 1 */}
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-[var(--muted)] uppercase tracking-widest block">Est. Compute Credits Burn rate</span>
                  <div className="text-xl font-mono font-black text-[var(--text)]">
                    {Math.round(simulatedQueries * (customKeyRatio / 100 * (globalConfig.customKeyCreditCharge) + (1 - customKeyRatio / 100) * 100) * (globalConfig.creditCostMultiplier || 1)).toLocaleString()}
                  </div>
                  <span className="text-[9px] font-bold text-[var(--muted)] leading-none">Compute credits allocated monthly</span>
                </div>

                {/* 2 */}
                <div className="space-y-1 border-[var(--line)] sm:border-l sm:pl-6">
                  <span className="text-[8px] font-black text-[var(--muted)] uppercase tracking-widest block">Gross Platform Cent Revenue</span>
                  <div className="text-xl font-mono font-black text-emerald-650">
                    ${((simulatedQueries * (1 - customKeyRatio / 100) * 0.01 * (globalConfig.quotaCentsMultiplier || 1)) + (simulatedQueries * (customKeyRatio / 100) * (globalConfig.customKeyCentsCharge / 100))).toFixed(2)}
                  </div>
                  <span className="text-[9px] font-bold text-[var(--muted)] leading-none">Estimated revenue pool per month</span>
                </div>

                {/* 3 */}
                <div className="space-y-1 border-[var(--line)] sm:border-l sm:pl-6">
                  <span className="text-[8px] font-black text-[var(--muted)] uppercase tracking-widest block">System Key Royaltiy Yield</span>
                  <div className="text-xl font-mono font-black text-indigo-650">
                    {Math.round(simulatedQueries * (customKeyRatio / 100) * globalConfig.customKeyCreditCharge).toLocaleString()} cr
                  </div>
                  <span className="text-[9px] font-bold text-[var(--muted)] leading-none">Royalty fee extracted from bypass API</span>
                </div>
              </div>
            </div>

            {/* Tenant Registry */}
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[32px] p-4 md:p-8 shadow-3xs relative overflow-hidden">
              <div className="absolute inset-0 technical-grid opacity-[0.01] pointer-events-none" />
              <div className="flex items-center justify-between pb-6 border-b border-[var(--line)] mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-6 bg-slate-900 rounded-full" />
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight italic">Multi-Tenant Ledger Matrix</h3>
                    <p className="text-[10px] text-[var(--muted)] font-bold tracking-wide uppercase mt-0.5">Click any workspace parameters row to customize limits & plans as Admin</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-[var(--muted)] text-[10px] font-medium uppercase tracking-wider bg-[var(--ink)]/50">
                      <th className="py-4 px-4">Workspace Identity / Name</th>
                      <th className="py-4 px-4 text-center">Plan</th>
                      <th className="py-4 px-4 text-right">Max Seats</th>
                      <th className="py-4 px-4 text-right">Compute Bal</th>
                      <th className="py-4 px-4 text-right">Quota ($)</th>
                      <th className="py-4 px-4 text-right">Used ($)</th>
                      <th className="py-4 px-4 text-right">Cost/User</th>
                      <th className="py-4 px-4 text-right">Tx Rows</th>
                      <th className="py-4 px-4 text-right">AI Requests</th>
                      <th className="py-4 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ledger-line font-medium text-[var(--text)]">
                    {telemetry.tenants.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-[var(--muted)] font-bold uppercase tracking-widest text-[10px]">
                          No workspaces detected on server
                        </td>
                      </tr>
                    ) : (
                      [...telemetry.tenants].sort((a: any, b: any) => b.requestCount - a.requestCount).map((tenant: any) => {
                        const isSpiking = tenant.requestCount > 500;
                        const usedDollars = ((tenant.apiQuotaTotalCentsUsed || 0) / 100).toFixed(2);
                        const activeUsers = tenant.activeUserCount || 1;
                        const costPerUser = (((tenant.apiQuotaTotalCentsUsed || 0) / 100) / activeUsers).toFixed(2);
                        return (
                          <tr 
                            key={tenant.id} 
                            onClick={() => startEditing(tenant)}
                            className="hover:bg-[#0047AB]/5 cursor-pointer transition-colors group"
                            title="Click to view and edit limits as systems administrator"
                          >
                            <td className="py-4 px-4">
                              <div className="font-mono text-xs text-slate-600 font-bold tracking-tight group-hover:text-[#0047AB]">
                                {tenant.id}
                              </div>
                              <div className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest mt-0.5 truncate max-w-[200px]">
                                {tenant.name || "Default Workspace"}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                "text-[9px] px-2 py-0.5 rounded-md font-medium uppercase tracking-wider border",
                                tenant.plan === 'enterprise' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                tenant.plan === 'growth' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                "bg-[var(--ink)] text-slate-600 border-[var(--line)]"
                              )}>
                                {tenant.plan || 'sandbox'}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right font-mono text-xs font-bold">
                              {tenant.maxSeats || 3}
                            </td>
                            <td className="py-4 px-4 text-right font-mono text-xs text-indigo-650 font-bold">
                              {(tenant.computeCreditBalance || 0).toLocaleString()}
                            </td>
                            <td className="py-4 px-4 text-right font-mono text-xs text-emerald-650 font-bold">
                              ${((tenant.apiQuotaMonthlyLimitCents || 0) / 100).toFixed(2)}
                            </td>
                            <td className="py-4 px-4 text-right font-mono text-xs text-rose-650 font-bold">
                              ${usedDollars}
                            </td>
                            <td className="py-4 px-4 text-right font-mono text-xs text-purple-650 font-bold">
                              ${costPerUser}
                            </td>
                            <td className="py-4 px-4 text-right font-mono text-xs text-[var(--muted)]">
                              {(tenant.txCount || 0).toLocaleString()}
                            </td>
                            <td className="py-4 px-4 text-right font-mono text-xs text-indigo-600">
                              {(tenant.requestCount || 0).toLocaleString()}
                            </td>
                            <td className="py-4 px-4 text-center">
                              {isSpiking ? (
                                <span className="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded-lg text-[9px] font-medium uppercase tracking-wider inline-flex items-center gap-1 shadow-3xs">
                                  Spiking
                                </span>
                              ) : tenant.errorCount > 0 ? (
                                <span className="bg-amber-5 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-lg text-[9px] font-medium uppercase tracking-wider">
                                  WARNING
                                </span>
                              ) : (
                                <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-lg text-[9px] font-medium uppercase tracking-wider group-hover:bg-[#0047AB] group-hover:text-white group-hover:border-[#0047AB] transition-all">
                                  OPTIMAL
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Edit Limits & Policies Modal Accent */}
          <AnimatePresence>
            {editingWorkspace && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4 animate-fade-in">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="bg-[var(--surface)] rounded-[32px] border border-[var(--line)] shadow-2xl p-4 md:p-8 max-w-xl w-full relative z-[210] overflow-hidden flex flex-col max-h-[90dvh] md:max-h-none"
                >
                  <div className="absolute top-0 inset-x-0 h-1 bg-[#0047AB]" />
                  
                  <div className="mb-4 flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">
                        Institutional Supervisor Control
                      </span>
                      <h3 className="text-2xl font-black text-[var(--text)] tracking-tight mt-1 truncate">Workspace Policy Editor</h3>
                      <p className="text-[var(--muted)] font-mono text-[9px] font-bold uppercase mt-0.5 truncate">Workspace Hash: {editingWorkspace.id}</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setEditingWorkspace(null)}
                      className="text-[var(--muted)] hover:text-slate-700 font-bold text-xs px-3 py-1.5 bg-[var(--ink)] hover:bg-slate-100 rounded-xl transition-all"
                    >
                      CLOSE (ESC)
                    </button>
                  </div>

                  {/* Horizontal Tab Navigation bar inside Modal */}
                  <div className="flex border-b border-[var(--line)] mb-5 overflow-x-auto gap-2 py-1 scrollbar-hidden">
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('tier')}
                      className={cn(
                        "px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap",
                        activeFormTab === 'tier' 
                          ? "bg-[#0047AB]/10 text-[#0047AB] border border-[#0047AB]/20" 
                          : "text-[var(--muted)] hover:text-slate-700 hover:bg-[var(--ink)]"
                      )}
                    >
                      <Sparkles size={12} /> Pricing & Plan
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('access')}
                      className={cn(
                        "px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap",
                        activeFormTab === 'access' 
                          ? "bg-[#0047AB]/10 text-[#0047AB] border border-[#0047AB]/20" 
                          : "text-[var(--muted)] hover:text-slate-700 hover:bg-[var(--ink)]"
                      )}
                    >
                      <Users size={12} /> Access & Seats
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('credits')}
                      className={cn(
                        "px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap",
                        activeFormTab === 'credits' 
                          ? "bg-[#0047AB]/10 text-[#0047AB] border border-[#0047AB]/20" 
                          : "text-[var(--muted)] hover:text-slate-700 hover:bg-[var(--ink)]"
                      )}
                    >
                      <Gift size={12} /> Grant Free Credits
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('roadmap')}
                      className={cn(
                        "px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap",
                        activeFormTab === 'roadmap' 
                          ? "bg-[#0047AB]/10 text-[#0047AB] border border-[#0047AB]/20" 
                          : "text-[var(--muted)] hover:text-slate-700 hover:bg-[var(--ink)]"
                      )}
                    >
                      <DollarSign size={12} /> Monetization
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('rates')}
                      className={cn(
                        "px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap",
                        activeFormTab === 'rates' 
                          ? "bg-[#0047AB]/10 text-[#0047AB] border border-[#0047AB]/20" 
                          : "text-[var(--muted)] hover:text-slate-700 hover:bg-[var(--ink)]"
                      )}
                    >
                      <Cpu size={12} /> Rates & Keys
                    </button>


                  </div>

                  <form onSubmit={handleSaveWorkspaceLimits} className="space-y-5 flex-1 overflow-y-auto max-h-[60dvh] pr-1 scrollbar-thin">
                    
                    {/* TAB 1: Pricing & Plan selector */}
                    {activeFormTab === 'tier' && (
                      <div className="space-y-4">
                        <div>
                          <Labelled labelClassName="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5" label="Assigned Plan Model">
                            <select
                              value={formState.plan}
                              onChange={(e) => setFormState(prev => ({ ...prev, plan: e.target.value }))}
                              className="w-full h-11 bg-[var(--ink)] border border-[var(--line)] rounded-xl px-3 text-xs font-bold text-[var(--text)] focus:border-[#0047AB] focus:ring-1 focus:ring-[#0047AB] outline-none cursor-pointer transition-all"
                            >
                              <option value="sandbox">Sandbox Tier (Capped default offline development)</option>
                              <option value="growth">Growth Platform Tier (Professional Core Business - Paid)</option>
                              <option value="enterprise">Enterprise VIP Tier (High-volume Dedicated Capacity - Paid Custom)</option>
                            </select>
                          </Labelled>
                        </div>

                        {/* Interactive plan features visual guide */}
                        <div className="grid grid-cols-1 gap-3 pt-2">
                          <div className={cn(
                            "p-3 rounded-[32px] border text-left transition-all",
                            formState.plan === 'sandbox' ? "bg-[var(--ink)] border-slate-300" : "bg-[var(--surface)] border-[var(--line)] opacity-60"
                          )}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-black text-[var(--text)] uppercase tracking-tight">Sandbox / Free Tier</span>
                              <span className="text-[9px] font-black uppercase text-[var(--muted)] bg-slate-100 px-2 py-0.5 rounded-lg">$0.00 / mo</span>
                            </div>
                            <p className="text-[10px] text-[var(--muted)] font-medium lowercase first-letter:uppercase">Includes 100k standard compute units, 3 seat limit, normal query rates. Ideal for trial accounts.</p>
                          </div>

                          <div className={cn(
                            "p-3 rounded-[32px] border text-left transition-all",
                            formState.plan === 'growth' ? "bg-emerald-50/40 border-emerald-300 shadow-3xs" : "bg-[var(--surface)] border-[var(--line)] opacity-60"
                          )}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-black text-[#2e7d32] uppercase tracking-tight flex items-center gap-1">
                                <Zap size={10} /> Growth Business Plan
                              </span>
                              <span className="text-[9px] font-black uppercase text-[#2e7d32] bg-emerald-50 px-2 py-0.5 rounded-lg">$49.00 / mo</span>
                            </div>
                            <p className="text-[10px] text-[var(--muted)] font-medium lowercase first-letter:uppercase">Allocates 500k standard compute credits, up to 15 seat limits, and standard API capabilities.</p>
                          </div>

                          <div className={cn(
                            "p-3 rounded-[32px] border text-left transition-all",
                            formState.plan === 'enterprise' ? "bg-purple-50/40 border-purple-300 shadow-3xs" : "bg-[var(--surface)] border-[var(--line)] opacity-60"
                          )}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-black text-purple-700 uppercase tracking-tight flex items-center gap-1">
                                <Building size={10} /> Institutional Enterprise
                              </span>
                              <span className="text-[9px] font-black uppercase text-purple-700 bg-purple-100 px-2 py-0.5 rounded-lg">Custom Quote</span>
                            </div>
                            <p className="text-[10px] text-[var(--muted)] font-medium lowercase first-letter:uppercase">Allocates custom credits (e.g. 5M+ credits), unlimited concurrent rate boundaries, VIP status.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: Access & Seats limit controls */}
                    {activeFormTab === 'access' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-[var(--ink)] rounded-[32px] border border-slate-150 flex items-center gap-3">
                          <Users size={16} className="text-[#0047AB]" />
                          <div>
                            <p className="text-xs font-black text-[var(--text)]">Seat Limits & Operations</p>
                            <p className="text-[10px] text-[var(--muted)]">Determine user access size per tenant. If seats count surpasses maximum limit, further user registration is blocked automatically.</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Labelled labelClassName="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5" label="Seat authorization (Max Seats)">
                              <input
                                type="number"
                                value={formState.maxSeats}
                                min={1}
                                max={500}
                                onChange={(e) => setFormState(prev => ({ ...prev, maxSeats: Number(e.target.value) }))}
                                className="w-full h-11 bg-[var(--ink)] border border-[var(--line)] rounded-xl px-4 text-xs font-mono font-bold text-[var(--text)] focus:border-[#0047AB] outline-none transition-all"
                              />
                            </Labelled>
                            <p className="text-[9px] text-[var(--muted)] mt-1 uppercase font-bold tracking-wider leading-relaxed">Capped at 500 seats/tenant</p>
                          </div>

                          <div>
                            <Labelled labelClassName="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5" label="Rate limit (Queries rate/min)">
                              <input
                                type="number"
                                value={formState.concurrentUserLimit}
                                min={5}
                                max={10000}
                                onChange={(e) => setFormState(prev => ({ ...prev, concurrentUserLimit: Number(e.target.value) }))}
                                className="w-full h-11 bg-[var(--ink)] border border-[var(--line)] rounded-xl px-4 text-xs font-mono font-bold text-[var(--text)] focus:border-[#0047AB] outline-none transition-all"
                              />
                            </Labelled>
                            <p className="text-[9px] text-[var(--muted)] mt-1 uppercase font-bold tracking-wider leading-relaxed">Prevents endpoint throttling</p>
                          </div>
                        </div>

                        {/* Lock / Suspense simulations */}
                        <div className="pt-2">
                          <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5">
                            Workspace Access Status
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              className="h-10 border border-emerald-250 bg-emerald-50 text-emerald-800 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
                              onClick={() => {
                                setFormState(prev => ({ ...prev, concurrentUserLimit: 60 }));
                              }}
                            >
                              <ShieldCheck size={12} /> Normal Access
                            </button>
                            <button
                              type="button"
                              className="h-10 border border-rose-250 bg-rose-50 text-rose-800 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
                              onClick={() => {
                                // Freeze by bringing rate limits down as simulator
                                setFormState(prev => ({ ...prev, concurrentUserLimit: 0 }));
                              }}
                            >
                              <AlertOctagon size={12} /> Freeze Account
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 3: Grant Promotional Credits (Giving Free) */}
                    {activeFormTab === 'credits' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-indigo-50/50 rounded-[32px] border border-indigo-150 flex items-center gap-3">
                          <Gift size={16} className="text-indigo-650" />
                          <div>
                            <p className="text-xs font-black text-[var(--text)]">Assign Free Promotional Allocations</p>
                            <p className="text-[10px] text-[var(--muted)]">Inject computational balance credits for testing, marketing, or to reward long-term institutional customers with free credit balances.</p>
                          </div>
                        </div>

                        <div>
                          <Labelled labelClassName="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5" label="Compute balance credits">
                            <input
                              type="number"
                              value={formState.computeCreditBalance}
                              min={0}
                              max={10000000}
                              onChange={(e) => setFormState(prev => ({ ...prev, computeCreditBalance: Number(e.target.value) }))}
                              className="w-full h-11 bg-[var(--ink)] border border-[var(--line)] rounded-xl px-4 text-xs font-mono font-bold text-[var(--text)] focus:border-[#0047AB] outline-none transition-all"
                            />
                          </Labelled>
                          <p className="text-[9px] text-[var(--muted)] mt-1 uppercase font-bold tracking-wider leading-relaxed">Required dynamically by rule classifying pipeline & algorithms on API routes</p>
                        </div>

                        {/* Quick Inject Grant Credit triggers */}
                        <div className="pt-2">
                          <span className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-widest mb-2 ml-0.5">Quick Grant Presets (Click to Load)</span>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setFormState(prev => ({ ...prev, computeCreditBalance: prev.computeCreditBalance + 50000 }))}
                              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-700 transition"
                            >
                              +50k Credits
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormState(prev => ({ ...prev, computeCreditBalance: prev.computeCreditBalance + 150000 }))}
                              className="px-3 py-2.5 bg-[#0047AB]/5 hover:bg-[#0047AB]/10 text-[#0047AB] border border-[#0047AB]/20 rounded-xl text-[10px] font-black uppercase transition"
                            >
                              +150k Promo
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormState(prev => ({ ...prev, computeCreditBalance: prev.computeCreditBalance + 1000000 }))}
                              className="px-3 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-250 rounded-xl text-[10px] font-black uppercase transition"
                            >
                              +1M Credits
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 4: Monetization Strategy & Cash Controls */}
                    {activeFormTab === 'roadmap' && (
                      <div className="space-y-4 text-left">
                        <div className="p-4 bg-[#0047AB]/5 rounded-[32px] border border-[#0047AB]/10 flex items-center gap-3">
                          <DollarSign size={16} className="text-[#0047AB]" />
                          <div>
                            <p className="text-xs font-black text-[var(--text)]">Monetization & API Limits ($)</p>
                            <p className="text-[10px] text-[var(--muted)]">Establish maximum billing limits per workspace to charge for premium services. Limit over-spending and manage enterprise custom invoicing.</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Labelled labelClassName="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5" label="API Monthly Limit ($)">
                              <input
                                type="number"
                                step="0.01"
                                value={(formState.apiQuotaMonthlyLimitCents / 100).toFixed(2)}
                                onChange={(e) => setFormState(prev => ({ ...prev, apiQuotaMonthlyLimitCents: Math.round(Number(e.target.value || 0) * 100) }))}
                                className="w-full h-11 bg-[var(--ink)] border border-[var(--line)] rounded-xl px-4 text-xs font-mono font-bold text-[var(--text)] focus:border-[#0047AB] outline-none transition-all"
                              />
                            </Labelled>
                            <p className="text-[9px] text-[var(--muted)] mt-1 uppercase font-bold tracking-wider leading-relaxed">Auto-caps programmatic use</p>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5">
                              Estimated Monthly Bill
                            </label>
                            <div className="w-full h-11 bg-slate-100 border border-[var(--line)] rounded-xl px-4 text-xs font-mono font-bold text-slate-600 flex items-center">
                              ${formState.plan === 'growth' ? '49.00 / mo' : formState.plan === 'enterprise' ? '299.00 / mo' : '0.00 (Free)'}
                            </div>
                            <p className="text-[9px] text-[var(--muted)] mt-1 uppercase font-bold tracking-wider leading-relaxed">Based on designated plan model</p>
                          </div>
                        </div>

                        <div className="p-4 bg-[var(--ink)] rounded-[32px] border border-[var(--line)]">
                          <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-1.5">Monetization Deployment Strategy</h4>
                          <p className="text-[10px] text-[var(--muted)] leading-relaxed uppercase tracking-wide">
                            LedgerFlow is fully structured to receive custom payment processors (e.g. Stripe Customer Portal). This admin system already manages and updates plans, quotas, and limits. By connecting a Stripe webhook, you will be able to process subscriptions and charge client cards directly, with this UI serving as your operational control tower.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* TAB 5: Pricing Multipliers & Cust Key Charges */}
                    {activeFormTab === 'rates' && (
                      <div className="space-y-4 text-left">
                        <div className="p-4 bg-emerald-50/50 rounded-[32px] border border-emerald-250/30 flex items-center gap-3">
                          <Cpu size={16} className="text-emerald-505 animate-pulse" />
                          <div>
                            <p className="text-xs font-black text-[var(--text)]">Dynamic Pricing Multipliers & Private Key Surcharges</p>
                            <p className="text-[10px] text-[var(--muted)] leading-relaxed">Provide granular overrides for this specific workspace. You can scale charging metrics from zero to premium amounts dynamically.</p>
                          </div>
                        </div>

                        {/* Bypass Switch */}
                        <div className="p-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] flex items-center justify-between">
                          <div>
                            <p className="text-xs font-black text-[var(--text)] uppercase tracking-tight">Bypass All Billing & Caps</p>
                            <p className="text-[9px] text-[var(--muted)] uppercase font-black tracking-wider mt-0.5">Gives unmetered free operations, bypassing freeze limits completely</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={formState.bypassBilling}
                              onChange={(e) => setFormState(prev => ({ ...prev, bypassBilling: e.target.checked }))}
                              className="sr-only peer" 
                            />
                            <div className="w-11 h-6 bg-slate-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--surface)] after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0047AB] bg-slate-300"></div>
                          </label>
                        </div>

                        {/* Cost Multipliers */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Labelled labelClassName="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5" label="Compute Credit Cost Multiplier">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="10"
                                value={formState.creditCostMultiplier}
                                onChange={(e) => setFormState(prev => ({ ...prev, creditCostMultiplier: Number(e.target.value || 0) }))}
                                className="w-full h-11 bg-[var(--ink)] border border-[var(--line)] rounded-xl px-4 text-xs font-mono font-bold text-[var(--text)] focus:border-[#0047AB] outline-none transition-all"
                              />
                            </Labelled>
                            <p className="text-[9px] text-[var(--muted)] mt-1 uppercase font-bold tracking-wider leading-relaxed">
                              0.00 = Free, 1.0 = Base, 2.0 = Double cost
                            </p>
                          </div>

                          <div>
                            <Labelled labelClassName="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5" label="Platform Spend Multiplier (Cents)">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="10"
                                value={formState.quotaCentsMultiplier}
                                onChange={(e) => setFormState(prev => ({ ...prev, quotaCentsMultiplier: Number(e.target.value || 0) }))}
                                className="w-full h-11 bg-[var(--ink)] border border-[var(--line)] rounded-xl px-4 text-xs font-mono font-bold text-[var(--text)] focus:border-[#0047AB] outline-none transition-all"
                              />
                            </Labelled>
                            <p className="text-[9px] text-[var(--muted)] mt-1 uppercase font-bold tracking-wider leading-relaxed">
                              0.00 = Free spend, 1.0 = Base multiplier
                            </p>
                          </div>
                        </div>

                        {/* Custom Key Parameters */}
                        <div className="p-4 bg-[var(--ink)] rounded-[32px] border border-[var(--line)] space-y-4">
                          <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Self-Funded API Key Rates</h4>
                          <p className="text-[9px] text-[var(--muted)] leading-normal uppercase tracking-wider font-extrabold">
                            Specify billing charges if this account provides their private Gemini key:
                          </p>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Labelled labelClassName="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5" label="Overhead Credits Per Query">
                                <input
                                  type="number"
                                  min="0"
                                  value={formState.customKeyCreditCharge}
                                  onChange={(e) => setFormState(prev => ({ ...prev, customKeyCreditCharge: Number(e.target.value || 0) }))}
                                  className="w-full h-10 bg-[var(--surface)] border border-slate-205 rounded-xl px-3 text-xs font-mono font-bold text-slate-850 focus:border-[#0047AB] outline-none transition-all"
                                />
                              </Labelled>
                              <p className="text-[9px] text-[var(--muted)] mt-1 uppercase font-bold tracking-wider">
                                Credits (default is 10)
                              </p>
                            </div>

                            <div>
                              <Labelled labelClassName="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5 ml-0.5" label="Overhead Cents Per Query">
                                <input
                                  type="number"
                                  min="0"
                                  value={formState.customKeyCentsCharge}
                                  onChange={(e) => setFormState(prev => ({ ...prev, customKeyCentsCharge: Number(e.target.value || 0) }))}
                                  className="w-full h-10 bg-[var(--surface)] border border-slate-205 rounded-xl px-3 text-xs font-mono font-bold text-slate-855 focus:border-[#0047AB] outline-none transition-all"
                                />
                              </Labelled>
                              <p className="text-[9px] text-[var(--muted)] mt-1 uppercase font-bold tracking-wider">
                                Platform cents (default is 0)
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}





                    <div className="flex gap-3 pt-4 border-t border-[var(--line)]">
                      <button
                        type="button"
                        onClick={() => setEditingWorkspace(null)}
                        className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-[var(--text)] rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingWorkspace}
                        className="flex-1 h-12 bg-slate-900 text-white hover:bg-[#0047AB] rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
                       aria-label="Action button">
                        {savingWorkspace ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          'Save administrative override'
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Right Column - Incident Stream */}
          <div className="space-y-6">
            {/* Stress Test Generator Panel */}
            <div className="bg-slate-900 border border-slate-800 text-white rounded-[32px] p-4 md:p-8 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 technical-grid opacity-[0.03] pointer-events-none" />
              <div className="flex items-center gap-3 mb-4 pb-2 border-b border-white/10">
                <Wrench className="text-pink-400 animate-spin-slow" size={18} />
                <h3 className="text-sm font-black uppercase tracking-wider text-pink-400">Stress Test Injector</h3>
              </div>
              <p className="text-[10px] text-white/50 uppercase font-black mb-4 leading-relaxed">
                Manually dispatch synthetic test requests to visualize real-time error piping, quota exception handling, and diagnostic reporting on the dashboard.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleTriggerStressEvent('normal_gemini')}
                  className="w-full py-2.5 bg-[var(--surface)]/5 hover:bg-[var(--surface)]/10 rounded-xl text-[9px] font-black uppercase text-white hover:text-indigo-300 transition-all text-left px-4 flex items-center justify-between"
                >
                  <span>1. POST /gemini/summarize (200 OK)</span>
                  <Play size={10} className="text-indigo-400" />
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerStressEvent('quota_low')}
                  className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl text-[9px] font-black uppercase text-amber-300 border border-amber-500/20 transition-all text-left px-4 flex items-center justify-between"
                >
                  <span>2. GET /transactions/ledger_audit (429 Rate Exceeded)</span>
                  <Play size={10} className="text-amber-400 animate-pulse" />
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerStressEvent('db_timeout')}
                  className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-[9px] font-black uppercase text-rose-300 border border-rose-500/20 transition-all text-left px-4 flex items-center justify-between"
                >
                  <span>3. GET /admin/telemetry (503 Service Unavailable)</span>
                  <Play size={10} className="text-rose-400 animate-pulse" />
                </button>
              </div>
            </div>

            {/* Diagnostic Logs Panel */}
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[32px] p-4 md:p-8 shadow-3xs flex flex-col h-[520px]">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--line)] mb-4">
                <div className="flex items-center gap-3">
                  <Terminal size={18} className="text-indigo-600 animate-pulse" />
                  <h3 className="text-base font-black uppercase tracking-tight italic text-[var(--text)]">Event Logging Stream</h3>
                </div>
                <div className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                </div>
              </div>

              {/* Log filter toggles */}
              <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl">
                <button 
                  type="button"
                  className="flex-1 py-1 text-[8px] font-black uppercase tracking-wider rounded-lg bg-[var(--surface)] text-[var(--text)] shadow-3xs"
                 aria-label="Latest Events ( )">
                  Latest Events ({liveErrors.length})
                </button>
                {simulatedLogs.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => setSimulatedLogs([])}
                    className="px-2 py-1 text-[8px] font-black uppercase tracking-wider rounded-lg text-rose-600 hover:bg-rose-50 transition"
                  >
                    Clear Sim
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 font-mono text-[10px]">
                {liveErrors.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] opacity-50 gap-2 text-center p-4">
                    <ShieldCheck size={36} className="text-emerald-500" />
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-700">Audit pipeline is empty</p>
                    <p className="text-[9px] lowercase max-w-[170px]">Invoke client endpoints to stream event triggers.</p>
                  </div>
                ) : (
                  withOccurrenceKeys(liveErrors, log => log.id || JSON.stringify([log.timestamp, log.method, log.path, log.statusCode, log.ip, log.apiKeyUsed])).map(({ item: log, key }) => {
                    const isError = log.statusCode >= 500;
                    const isWarning = log.statusCode === 429;
                    return (
                      <div 
                        key={key}
                        className={cn(
                          "p-4 border rounded-[32px] relative overflow-hidden shadow-3xs transition-all",
                          isError ? "bg-rose-50/50 border-rose-150" : 
                          isWarning ? "bg-amber-50/50 border-amber-150" : 
                          "bg-[var(--ink)] border-slate-150"
                        )}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className={cn(
                            "text-[8px] font-bold px-1.5 py-0.5 rounded-md border",
                            isError ? "bg-rose-50 text-rose-700 border-rose-200" :
                            isWarning ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-indigo-50 text-indigo-700 border-indigo-200"
                          )}>
                            HTTP_{log.statusCode} {log.simulated && '[SIMULATED]'}
                          </span>
                          <span className="text-[var(--muted)] text-[8px] uppercase font-bold">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="mb-2 font-black text-[var(--text)] break-all leading-tight text-xs">
                          <span className={cn(
                            "font-bold mr-1.5",
                            isError ? "text-rose-600" : isWarning ? "text-amber-600" : "text-indigo-600"
                          )}>{log.method}</span> {log.path}
                        </div>
                        <div className="space-y-0.5 text-[8px] text-[var(--muted)] font-semibold uppercase tracking-wider pt-1.5 border-t border-[var(--line)]">
                          <div>Source Node: {log.ip}</div>
                          <div className="truncate">Client Ref: {log.apiKeyUsed}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Platform spec box */}
            <div className="bg-slate-900 text-white rounded-[32px] p-4 md:p-8 relative overflow-hidden group">
              <div className="absolute technical-grid inset-0 opacity-[0.05]" />
              <Cpu size={32} className="text-emerald-400 mb-4" />
              <h5 className="text-lg font-black tracking-tight italic uppercase mb-1">Decentralized Trust Hook</h5>
              <p className="text-[10px] font-medium text-white/40 leading-relaxed uppercase tracking-widest leading-loose">
                Real-time cryptographic pipeline audits. Mutex locks prevent race overrides, securing multi-tenant ledger synchronization bounds on memory channels.
              </p>
            </div>
          </div>
        </div>
        )}
      </div>
      )}

      {/* Bulk Synchronization Progress Success Modal */}
      <AnimatePresence>
        {showBulkSuccess && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[250] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--surface)] rounded-[32px] border border-[var(--line)] shadow-2xl p-4 md:p-8 max-w-sm w-full text-center relative"
            >
              <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-xl font-black text-[var(--text)] uppercase tracking-tight">Ledger Synchronized</h3>
              <p className="text-xs text-[var(--muted)] mt-2 uppercase tracking-wide leading-relaxed">
                Successfully propagated global cost coefficients, spend multipliers, and private api key surcharges to all {telemetry?.tenants?.length || 0} active workspaces securely.
              </p>
              <button
                type="button"
                onClick={() => setShowBulkSuccess(false)}
                className="w-full mt-6 h-11 bg-slate-900 hover:bg-[#0047AB] text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md cursor-pointer"
              >
                Acknowledge alignment
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
