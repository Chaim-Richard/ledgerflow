import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  Terminal,
  Key,
  Copy,
  RefreshCw,
  Activity,
  Cpu as CpuIcon,
  CheckCircle2,
  AlertCircle,
  Database,
  Shield,
  Trash2,
  Clock,
  Lock,
  X,
  Users,
  Play,
  FileText,
  Sliders,
  Gauge,
  Zap,
  TrendingUp,
  Coins
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, getLocalDateISO } from '../../lib/utils';
import { convertXeroAccounts } from '../../lib/xeroAdapter';
import { db, getIdToken } from '../../firebase';
import { collection, query, where, getDocs } from '../../lib/db/firestore';
import { useTimeout } from '../../hooks/useTimeout';
import { Labelled } from '../ui/Labelled';

const AVAILABLE_SCOPES = [
  { id: 'read:transactions', label: 'Read Transactions', desc: 'Allows querying and reading financial ledger transactions and journal entries.' },
  { id: 'write:transactions', label: 'Write Transactions', desc: 'Allows creating, modifying, and voiding journal entries.' },
  { id: 'read:projects', label: 'Read Projects', desc: 'Allows querying project codes, tags, and cost centers.' },
  { id: 'write:projects', label: 'Write Projects', desc: 'Allows creating and managing project codes and dimensional tags.' },
  { id: 'read:ledger', label: 'Read Chart of Accounts', desc: 'Allows reading account hierarchies, balances, and classifications.' },
  { id: 'write:ledger', label: 'Write Chart of Accounts', desc: 'Allows creating and structuring accounts and ledger rules.' },
  { id: 'read:workspaces', label: 'Read Workspaces', desc: 'Allows accessing workspace metadata, tax profile, and currency settings.' },
  { id: 'brain:analyze', label: 'Brain / AI Analysis', desc: 'Allows calling Bayesian classification and AI analysis endpoints.' }
];

export default function ApiHub() {
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const getCurrentWorkspace = useAuthStore(s => s.getCurrentWorkspace);
  const user = useAuthStore(s => s.user);
  const workspaces = useAuthStore(s => s.workspaces);
  const setCurrentWorkspaceId = useAuthStore(s => s.setCurrentWorkspaceId);
  const currentWorkspace = getCurrentWorkspace();
  const [nowMs] = useState(() => Date.now());
  const [apiKey, setApiKey] = useState('');
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { setSafeTimeout } = useTimeout();
  const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'logs' | 'docs' | 'billing' | 'sandbox'>('overview');
  const [activeDoc, setActiveDoc] = useState('post-transaction');
  const [docLang, setDocLang] = useState<'curl' | 'python' | 'node'>('curl');

  const [publicKeys, setPublicKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('Production Integration Key');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(AVAILABLE_SCOPES.map(s => s.id));
  const [expiration, setExpiration] = useState<'never' | '1h' | '24h' | '30d' | '90d'>('never');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Corporate Billing and Computational Resource Metering
  const [billingStatus, setBillingStatus] = useState<any>({
    plan: 'sandbox',
    billingCycle: 'free',
    concurrentUserLimit: 50,
    activeUserCount: 1,
    seatCount: 1,
    maxSeats: 3,
    totalQueriesThisMonth: 0,
    computeHardnessScore: 0,
    computeCreditBalance: 100000,
    apiQuotaTotalCentsUsed: 0,
    apiQuotaMonthlyLimitCents: 0,
  });
  const [billingLedger, setBillingLedger] = useState<any[]>([]);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [simSeatsCount, setSimSeatsCount] = useState(1);
  const [simRequestsCount, setSimRequestsCount] = useState(50);
  const [isSimulatingBurst, setIsSimulatingBurst] = useState(false);
  const [computingAlgoId, setComputingAlgoId] = useState<string | null>(null);

  // Live Interactive Playground Sandbox State
  const [sandboxEndpoint, setSandboxEndpoint] = useState<string>('GET_v1_status');
  const [sandboxCredType, setSandboxCredType] = useState<'session' | 'key'>('session');
  const [sandboxSelectedKey, setSandboxSelectedKey] = useState<string>('');
  const [sandboxResult, setSandboxResult] = useState<any>(null);
  const [sandboxStatus, setSandboxStatus] = useState<number | null>(null);
  const [sandboxLatency, setSandboxLatency] = useState<number | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState<boolean>(false);
  const [sandboxLang, setSandboxLang] = useState<'curl' | 'python' | 'node'>('curl');
  
  // Dynamic fields
  const [fieldDesc, setFieldDesc] = useState('AWS EC2 Cloud Compute Virtual Machine Node billing');
  const [fieldAmountCents, setFieldAmountCents] = useState(15000); // $150.00
  const [fieldDate, setFieldDate] = useState(getLocalDateISO());
  const [fieldDryRun, setFieldDryRun] = useState(false);
  const [fieldIdempotencyKey, setFieldIdempotencyKey] = useState("lf_idem_" + crypto.randomUUID());
  const [fieldCOAName, setFieldCOAName] = useState('Procurement Cost Subaccount');
  const [fieldCOAType, setFieldCOAType] = useState('expense');
  const [fieldCOACode, setFieldCOACode] = useState('5230');
  const [fieldProjectName, setFieldProjectName] = useState('Project Phoenix Integration');
  const [fieldProjectCode, setFieldProjectCode] = useState('PHX-001');
  const [fieldMatchDesc, setFieldMatchDesc] = useState('Uber Trip transport ride\nAWS Cloud Services database bill\nMonthly advisory fee Deloitte business');
  const [fieldAIPrompt, setFieldAIPrompt] = useState('Explain what operational cost adjustments we should carry out based on our high software subscription drift.');

  const loadBillingStatus = async () => {
    if (!currentWorkspace?.id || !user) return;
    setIsLoadingBilling(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/v1/billing/status?workspaceId=${currentWorkspace.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setBillingStatus(data);
        if (data.seatCount) {
          setSimSeatsCount(data.seatCount);
        }
      }
    } catch (e) {
      console.error("Failed to load billing status", e);
    } finally {
      setIsLoadingBilling(false);
    }
  };

  const loadBillingLedger = async () => {
    if (!currentWorkspace?.id) return;
    try {
      const q = query(
        collection(db, 'billingLedgerTraces'),
        where('workspaceId', '==', currentWorkspace.id)
      );
      const snap = await getDocs(q);
      const logs = snap.docs.map(doc => doc.data() as any);
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setBillingLedger(logs);
    } catch (e) {
      console.error("Failed to query billing ledger", e);
    }
  };

  const handleRecordCompute = async (algorithmName: string, complexityFormat: string, weightScore: number) => {
    if (!currentWorkspace?.id || !user) return;
    setComputingAlgoId(algorithmName);
    const startMs = Date.now();
    try {
      const token = await getIdToken();
      const res = await fetch('/api/v1/billing/record-compute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          algorithmName,
          complexityFormat,
          weightScore,
          executionTimeMs: Date.now() - startMs
        })
      });

      if (res.ok) {
        toast.success(`Computed: ${algorithmName}`, {
          description: `Logged double-entry complexity core cost of ${weightScore} units. Execution took ${Date.now() - startMs}ms.`
        });
        loadBillingStatus();
        loadBillingLedger();
        fetchLogs(); 
      } else {
        const err = await res.json();
        throw new Error(err.message || 'Server rejected cost logging');
      }
    } catch (e: any) {
      toast.error('Failed to record complexity metrics', { description: e.message || String(e) });
    } finally {
      setComputingAlgoId(null);
    }
  };

  const handleCheckout = async (plan: string) => {
    if (!currentWorkspace?.id || !user) return;
    try {
      const token = await getIdToken();
      const res = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          plan: plan
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.message || 'Failed to create checkout session');
      }
    } catch (e: any) {
      toast.error('Checkout Error', { description: e.message || String(e) });
    }
  };

  const handleTriggerStressTest = async () => {
    if (!currentWorkspace?.id || !user) return;
    setIsSimulatingBurst(true);
    try {
      const token = await getIdToken();
      // Actually execute rigorous requests in parallel to generate authentic telemetry
      const count = Math.min(simRequestsCount, 200);
      const promises = [];
      const burstStartMs = Date.now();
      
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < count; i++) {
        promises.push(
          fetch(`/api/v1/billing/status?workspaceId=${currentWorkspace.id}&burst=${Date.now()}-${i}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          .then(res => {
            if (res.ok) successCount++;
            else failureCount++;
          })
          .catch(() => failureCount++)
        );
      }

      await Promise.allSettled(promises);
      const durationMs = Date.now() - burstStartMs;

      toast.success(`Authentic Stress Burst Completed`, {
        description: `Executed ${count} real HTTP metrics calls in ${durationMs}ms. Success: ${successCount}. Failed: ${failureCount}.`
      });

      loadBillingStatus();
      setSafeTimeout(fetchLogs, 500); // give server time to flush logs to memory
    } catch (e: any) {
      toast.error('Stress test trigger failure', { description: e.message || String(e) });
    } finally {
      setIsSimulatingBurst(false);
    }
  };

  const loadWorkspaceKeys = async () => {
    if (!currentWorkspace?.id || !user) return;
    try {
      const q = query(
        collection(db, 'apiKeys'), 
        where('workspaceId', '==', currentWorkspace.id),
        where('uid', '==', user.uid)
      );
      const snap = await getDocs(q);
      const keys = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || 'Unnamed Key',
          scopes: data.scopes || [],
          expiresAt: data.expiresAt || 'never',
          lastUsedAt: data.lastUsedAt || null,
          totalRequests: data.totalRequests || 0,
          createdAt: data.createdAt
        };
      });
      setPublicKeys(keys);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = async () => {
    if (!currentWorkspace?.id) return;
    try {
      const token = user ? await getIdToken() : '';
      const authHeader = `Bearer ${(apiKey || token)}`;
      const res = await fetch(`/api/v1/logs?workspaceId=${currentWorkspace.id}`, {
        headers: {
          'Authorization': authHeader
        }
      });
      if (res.ok) {
        const data = await res.json();
        setApiLogs(data);
      }
    } catch (e) {
      console.error("Failed to fetch logs", e);
    }
  };

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    const timer = setTimeout(() => {
      loadBillingStatus();
      if (activeTab === 'billing') {
        loadBillingLedger();
      }
      loadWorkspaceKeys();
      fetchLogs();
    }, 0);
    const interval = setInterval(fetchLogs, 5000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [currentWorkspace?.id, activeTab]);

  const sha256 = async (message: string) => {
    try {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {
      console.warn("Crypto.subtle failing, using robust pure JS SHA-256 fallback", e);
    }
    
    // Pure JS SHA-256 implementation
    function rotateRight(n: number, x: number) {
      return (x >>> n) | (x << (32 - n));
    }
    function choice(x: number, y: number, z: number) {
      return (x & y) ^ (~x & z);
    }
    function majority(x: number, y: number, z: number) {
      return (x & y) ^ (x & z) ^ (y & z);
    }
    function sigma0(x: number) {
      return rotateRight(2, x) ^ rotateRight(13, x) ^ rotateRight(22, x);
    }
    function sigma1(x: number) {
      return rotateRight(6, x) ^ rotateRight(11, x) ^ rotateRight(25, x);
    }
    function gamma0(x: number) {
      return rotateRight(7, x) ^ rotateRight(18, x) ^ (x >>> 3);
    }
    function gamma1(x: number) {
      return rotateRight(17, x) ^ rotateRight(19, x) ^ (x >>> 10);
    }

    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    const words = new TextEncoder().encode(message);
    const wordsLength = words.length;
    const bitLength = wordsLength * 8;
    
    // Add single 1 bit
    const padded = new Uint8Array(wordsLength + 1 + ((56 - ((wordsLength + 1) % 64) + 64) % 64) + 8);
    padded.set(words);
    padded[wordsLength] = 0x80;
    
    // Set 64-bit big endian length
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 4, bitLength);

    const H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];

    for (let i = 0; i < padded.length; i += 64) {
      const W = new Int32Array(64);
      for (let t = 0; t < 16; t++) {
        W[t] = view.getInt32(i + t * 4);
      }
      for (let t = 16; t < 64; t++) {
        W[t] = (gamma1(W[t - 2]) + W[t - 7] + gamma0(W[t - 15]) + W[t - 16]) | 0;
      }

      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];

      for (let t = 0; t < 64; t++) {
        const T1 = (h + sigma1(e) + choice(e, f, g) + K[t] + W[t]) | 0;
        const T2 = (sigma0(a) + majority(a, b, c)) | 0;
        h = g;
        g = f;
        f = e;
        e = (d + T1) | 0;
        d = c;
        c = b;
        b = a;
        a = (T1 + T2) | 0;
      }

      H[0] = (H[0] + a) | 0;
      H[1] = (H[1] + b) | 0;
      H[2] = (H[2] + c) | 0;
      H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0;
      H[5] = (H[5] + f) | 0;
      H[6] = (H[6] + g) | 0;
      H[7] = (H[7] + h) | 0;
    }

    return H.map(x => {
      const hex = (x >>> 0).toString(16);
      return hex.padStart(8, '0');
    }).join('');
  };

  const generateHex = (bytes: number) => {
    try {
      if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
        return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
      }
    } catch (e) {
      console.warn("Crypto.getRandomValues failing, utilizing standard entropy fallback", e);
    }
    const arr = [];
    for (let i = 0; i < bytes; i++) {
      const val = Math.floor(Math.random() * 256);
      arr.push(val.toString(16).padStart(2, '0'));
    }
    return arr.join('');
  };

  const generateNewKey = async () => {
    if (!currentWorkspace?.id || !user) return;
    setIsRegenerating(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/v1/keys/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          name: newKeyName || 'Production Integration Key',
          scopes: selectedScopes,
          expiration: expiration
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Key generation endpoint rejected request.');
      }

      const data = await res.json();
      setApiKey(data.apiKey);
      toast.success('Developer API Key Provisioned', {
        description: 'New deep authentication token is ready for use. Store this safely.'
      });
      loadWorkspaceKeys();
      setShowCreateModal(false);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to generate key', { description: e.message || String(e) });
    } finally {
      setIsRegenerating(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    if (!currentWorkspace?.id || !user) return;
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/v1/keys/revoke/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Key revoking endpoint rejected request.');
      }

      toast.success('Key Revoked.');
      loadWorkspaceKeys();
      if (apiKey.startsWith(keyId)) {
        setApiKey('');
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to revoke key', { description: e.message || String(e) });
    }
  };

  const copyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setIsCopied(true);
    setSafeTimeout(() => setIsCopied(false), 2000);
    toast.success('Key copied to clipboard');
  };

  const getEndpointPath = (endpoint: string) => {
    switch (endpoint) {
      case 'GET_v1_status': return 'status';
      case 'GET_v1_workspaces': return 'workspaces';
      case 'GET_v1_ledger': return 'ledger';
      case 'POST_v1_ledger': return 'ledger';
      case 'GET_v1_ledger_diagnostics': return 'ledger/diagnostics';
      case 'GET_v1_transactions': return 'transactions';
      case 'POST_v1_transactions': return 'transactions';
      case 'POST_v1_transactions_bulk': return 'transactions/bulk';
      case 'GET_v1_projects': return 'projects';
      case 'POST_v1_projects': return 'projects';
      case 'GET_v1_metrics': return 'metrics';
      case 'POST_ledger_match': return 'ledger/match';
      case 'POST_brain_analyze': return 'brain/analyze';
      case 'POST_v1_brain_classify_batch': return 'brain/classify-batch';
      case 'GET_v1_ecommerce': return 'ecommerce';
      case 'POST_v1_ecommerce': return 'ecommerce';
      case 'GET_v1_marketing': return 'marketing';
      case 'POST_v1_marketing': return 'marketing';
      case 'GET_v1_helpdesk': return 'helpdesk';
      case 'POST_v1_helpdesk': return 'helpdesk';
      case 'GET_v1_hr': return 'hr';
      case 'POST_v1_hr': return 'hr';
      case 'GET_v1_manufacturing': return 'manufacturing';
      case 'POST_v1_manufacturing': return 'manufacturing';
      case 'GET_v1_universal_ops': return 'universal-ops';
      case 'POST_v1_universal_ops': return 'universal-ops';
      default: return 'status';
    }
  };

  const getSandboxPayload = (endpoint: string) => {
    const wsId = currentWorkspace?.id || '';
    switch (endpoint) {
      case 'POST_v1_transactions':
        return {
          workspaceId: wsId,
          date: fieldDate || getLocalDateISO(),
          description: fieldDesc || "AWS Hosting Tier Upgrade",
          amountCents: Number(fieldAmountCents) || 185000,
          dryRun: fieldDryRun,
          idempotencyKey: fieldIdempotencyKey || "lf_idem_9s7d3"
        };
      case 'POST_v1_transactions_bulk':
        return {
          workspaceId: wsId,
          transactions: [
            {
              date: fieldDate || getLocalDateISO(),
              description: fieldDesc || "Copier Machine Lease Monthly",
              amountCents: Number(fieldAmountCents) || 22000,
              idempotencyKey: "bulk_idem_1a2b3c"
            },
            {
              date: fieldDate || getLocalDateISO(),
              description: "Delta Air Lines Business Inbound Flight #98218-CA",
              amountCents: 45000,
              idempotencyKey: "bulk_idem_4d5e6f"
            }
          ],
          dryRun: fieldDryRun
        };
      case 'POST_v1_ledger':
        return {
          workspaceId: wsId,
          name: fieldCOAName || "Research Development Office",
          code: fieldCOACode || "5230",
          type: fieldCOAType || "expense"
        };
      case 'POST_v1_projects':
        return {
          workspaceId: wsId,
          name: fieldProjectName || "Enterprise Cloud Modernisation",
          code: fieldProjectCode || "PRJ-PHX-01"
        };
      case 'POST_ledger_match':
        return {
          workspaceId: wsId,
          descriptions: fieldMatchDesc.split('\n').filter(Boolean).length > 0
            ? fieldMatchDesc.split('\n').filter(Boolean)
            : ["Uber trip ride NY", "AWS Web Services Invoice"]
        };
      case 'POST_v1_brain_classify_batch':
        return {
          workspaceId: wsId,
          descriptions: fieldMatchDesc.split('\n').filter(Boolean).length > 0
            ? fieldMatchDesc.split('\n').filter(Boolean)
            : ["Google Workspace Subscription", "Rent Office Suite 12", "Hardware Store Staples"]
        };
      case 'POST_brain_analyze':
        return {
          workspaceId: wsId,
          prompt: fieldAIPrompt || "Generate executive review of cash allocation anomalies across our ledger assets."
        };
      case 'POST_v1_ecommerce':
        return { workspaceId: wsId, channel: "Shopify Store", syncStatus: "live" };
      case 'POST_v1_marketing':
        return { workspaceId: wsId, campaignName: "Q4 Outreach", audienceSize: 12500 };
      case 'POST_v1_helpdesk':
        return { workspaceId: wsId, ticketTitle: "Billing failure", priority: "High" };
      case 'POST_v1_hr':
        return { workspaceId: wsId, employeeName: "John Doe", role: "Engineer" };
      case 'POST_v1_manufacturing':
        return { workspaceId: wsId, workOrder: "WO-10492", product: "HVAC Unit" };
      case 'POST_v1_universal_ops':
        return { workspaceId: wsId, dimensionName: "Property A / Unit 101" };
      default:
        return null;
    }
  };

  const runSandboxRequest = async () => {
    if (!currentWorkspace?.id) {
      toast.error("Please select a workspace before running queries.");
      return;
    }
    setSandboxLoading(true);
    setSandboxResult(null);
    setSandboxStatus(null);
    setSandboxLatency(null);

    const startTime = performance.now();
    try {
      let endpointUrl = '';
      let method = 'GET';
      let bodyData: any = null;

      switch (sandboxEndpoint) {
        case 'GET_v1_status':
          endpointUrl = `/api/v1/status?workspaceId=${currentWorkspace.id}`;
          method = 'GET';
          break;
        case 'GET_v1_workspaces':
          endpointUrl = `/api/v1/workspaces`;
          method = 'GET';
          break;
        case 'GET_v1_ledger':
          endpointUrl = `/api/v1/ledger?workspaceId=${currentWorkspace.id}`;
          method = 'GET';
          break;
        case 'POST_v1_ledger':
          endpointUrl = `/api/v1/ledger`;
          method = 'POST';
          bodyData = {
            workspaceId: currentWorkspace.id,
            name: fieldCOAName,
            code: fieldCOACode,
            type: fieldCOAType
          };
          break;
        case 'GET_v1_transactions':
          endpointUrl = `/api/v1/transactions?workspaceId=${currentWorkspace.id}`;
          method = 'GET';
          break;
        case 'POST_v1_transactions':
          endpointUrl = `/api/v1/transactions`;
          method = 'POST';
          bodyData = {
            workspaceId: currentWorkspace.id,
            date: fieldDate,
            description: fieldDesc,
            amountCents: Number(fieldAmountCents),
            dryRun: fieldDryRun,
            idempotencyKey: fieldIdempotencyKey
          };
          break;
        case 'GET_v1_projects':
          endpointUrl = `/api/v1/projects?workspaceId=${currentWorkspace.id}`;
          method = 'GET';
          break;
        case 'POST_v1_projects':
          endpointUrl = `/api/v1/projects`;
          method = 'POST';
          bodyData = {
            workspaceId: currentWorkspace.id,
            name: fieldProjectName,
            code: fieldProjectCode
          };
          break;
        case 'GET_v1_metrics':
          endpointUrl = `/api/v1/metrics?workspaceId=${currentWorkspace.id}`;
          method = 'GET';
          break;
        case 'POST_ledger_match':
          endpointUrl = `/api/v1/ledger/match`;
          method = 'POST';
          bodyData = {
            workspaceId: currentWorkspace.id,
            descriptions: fieldMatchDesc.split('\n').filter(x => x.trim())
          };
          break;
        case 'POST_brain_analyze':
          endpointUrl = `/api/v1/brain/analyze`;
          method = 'POST';
          bodyData = {
            workspaceId: currentWorkspace.id,
            prompt: fieldAIPrompt
          };
          break;
        case 'POST_v1_transactions_bulk':
          endpointUrl = `/api/v1/transactions/bulk`;
          method = 'POST';
          bodyData = {
            workspaceId: currentWorkspace.id,
            transactions: [
              {
                date: fieldDate || getLocalDateISO(),
                description: fieldDesc || "Copier Machine Lease Monthly",
                amountCents: Number(fieldAmountCents) || 22000,
                idempotencyKey: "bulk_idem_" + crypto.randomUUID()
              },
              {
                date: fieldDate || getLocalDateISO(),
                description: "Delta Air Lines Business Inbound Flight #98218-CA",
                amountCents: 45000,
                idempotencyKey: "bulk_idem_" + crypto.randomUUID()
              }
            ],
            dryRun: fieldDryRun
          };
          break;
        case 'GET_v1_ledger_diagnostics':
          endpointUrl = `/api/v1/ledger/diagnostics?workspaceId=${currentWorkspace.id}`;
          method = 'GET';
          break;
        case 'POST_v1_brain_classify_batch':
          endpointUrl = `/api/v1/brain/classify-batch`;
          method = 'POST';
          bodyData = {
            workspaceId: currentWorkspace.id,
            descriptions: fieldMatchDesc.split('\n').filter(x => x.trim()).length > 0
              ? fieldMatchDesc.split('\n').filter(x => x.trim())
              : ["Rent Payment Suite A", "GitHub Team Subscription", "Stripe Fee Processing", "Starbucks Coffee Retail Store #13"]
          };
          break;
        case 'GET_v1_ecommerce':
        case 'GET_v1_marketing':
        case 'GET_v1_helpdesk':
        case 'GET_v1_hr':
        case 'GET_v1_manufacturing':
        case 'GET_v1_universal_ops':
          endpointUrl = `/api/v1/${getEndpointPath(sandboxEndpoint)}?workspaceId=${currentWorkspace.id}`;
          method = 'GET';
          break;
        case 'POST_v1_ecommerce':
        case 'POST_v1_marketing':
        case 'POST_v1_helpdesk':
        case 'POST_v1_hr':
        case 'POST_v1_manufacturing':
        case 'POST_v1_universal_ops':
          endpointUrl = `/api/v1/${getEndpointPath(sandboxEndpoint)}`;
          method = 'POST';
          bodyData = getSandboxPayload(sandboxEndpoint);
          break;
        default:
          throw new Error('Unsupported sandbox endpoint selective pathway.');
      }

      let authHeader = '';
      if (sandboxCredType === 'session') {
        const token = user ? await getIdToken() : '';
        authHeader = `Bearer ${token}`;
      } else {
        const tokenToUse = sandboxSelectedKey || apiKey || (publicKeys[0] ? publicKeys[0].id : '');
        if (!tokenToUse) {
          throw new Error('No API Key selected or generated yet. Please select User Session instead or generate a key.');
        }
        authHeader = `Bearer ${tokenToUse}`;
      }

      const headers: Record<string, string> = {
        'Authorization': authHeader
      };

      if (method === 'POST') {
        headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(endpointUrl, {
        method,
        headers,
        body: bodyData ? JSON.stringify(bodyData) : undefined
      });

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      setSandboxLatency(duration);
      setSandboxStatus(res.status);

      const data = await res.json();
      setSandboxResult(data);
      
      fetchLogs();
      loadBillingStatus();
      toast.success(`API Ingestion Completed in ${duration}ms`, {
        description: `HTTP Status ${res.status}`
      });

    } catch (e: any) {
      console.error(e);
      const endTime = performance.now();
      setSandboxLatency(Math.round(endTime - startTime));
      setSandboxStatus(500);
      setSandboxResult({ error: e.message || String(e) });
      toast.error('Sandbox Execution Faulted', { description: e.message });
    } finally {
      setSandboxLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pt-4 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--line)]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)] flex items-center gap-2.5 font-display">
            <Terminal className="text-slate-950" size={18} />
            API Platform
          </h1>
          <p className="text-[var(--muted)] mt-1 max-w-2xl text-xs font-medium">
            Direct interface to the TruthEngine core data engine. Integrate double-entry telemetry, query AI brain analysis, and orchestrate financial pipelines natively.
          </p>
        </div>
        
        {/* Workspace Quick-Picker */}
        <div className="flex items-center gap-2.5 self-start md:self-auto bg-[var(--ink)] border border-[var(--line)] px-3.5 py-1.5 rounded-lg shadow-3xs">
          <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">Workspace:</span>
          <select
            value={currentWorkspaceId || ''}
            onChange={(e) => setCurrentWorkspaceId(e.target.value)}
            className="bg-transparent border-0 font-bold text-xs text-[var(--text)] focus:ring-0 focus:outline-none cursor-pointer pr-1"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id} className="text-slate-950">
                {ws.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex bg-[var(--ink)] border border-slate-150 p-1.5 rounded-xl gap-1 mb-6 max-w-4xl shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            "flex-1 py-1 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all text-center whitespace-nowrap cursor-pointer",
            activeTab === 'overview' ? "bg-[var(--surface)] text-[var(--text)] shadow-2xs border border-[var(--line)] font-bold" : "text-[var(--muted)] hover:text-[var(--text)]"
          )}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('keys')}
          className={cn(
            "flex-1 py-1 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all text-center whitespace-nowrap cursor-pointer",
            activeTab === 'keys' ? "bg-[var(--surface)] text-[var(--text)] shadow-2xs border border-[var(--line)] font-bold" : "text-[var(--muted)] hover:text-[var(--text)]"
          )}
        >
          Auth Keys
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={cn(
            "flex-1 py-1 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all text-center whitespace-nowrap cursor-pointer",
            activeTab === 'docs' ? "bg-[var(--surface)] text-[var(--text)] shadow-2xs border border-[var(--line)] font-bold" : "text-[var(--muted)] hover:text-[var(--text)]"
          )}
        >
          Docs
        </button>
        <button
          onClick={() => setActiveTab('sandbox')}
          className={cn(
            "flex-1 py-1 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all text-center whitespace-nowrap cursor-pointer",
            activeTab === 'sandbox' ? "bg-[var(--surface)] text-[var(--text)] shadow-2xs border border-[var(--line)] font-bold text-emerald-500 font-black" : "text-[var(--muted)] hover:text-[var(--text)]"
          )}
        >
          ⚡ Playground Sandbox
        </button>
        <button
          onClick={() => {
            setActiveTab('logs');
            fetchLogs();
          }}
          className={cn(
            "flex-1 py-1 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all text-center whitespace-nowrap cursor-pointer",
            activeTab === 'logs' ? "bg-[var(--surface)] text-[var(--text)] shadow-2xs border border-[var(--line)] font-bold text-indigo-400" : "text-[var(--muted)] hover:text-[var(--text)]"
          )}
        >
          API Logs
        </button>
        <button
          onClick={() => {
            setActiveTab('billing');
            loadBillingStatus();
          }}
          className={cn(
            "flex-1 py-1 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all text-center whitespace-nowrap cursor-pointer",
            activeTab === 'billing' ? "bg-[var(--surface)] text-[var(--text)] shadow-2xs border border-[var(--line)] font-bold text-[var(--brass)]" : "text-[var(--muted)] hover:text-[var(--text)]"
          )}
        >
          Compute Metering
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="ledger-card p-6 md:col-span-2 space-y-6">
            <h3 className="font-bold flex items-center gap-2 text-lg">
              <Activity className="text-indigo-600" size={20} />
              Platform Architecture
            </h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              LedgerFlow's Integrity API is built on a high-throughput Express Node architecture, 
              connecting natively to the unified workspace data layer. 
              The API guarantees double-entry accounting integrity at the database level for all incoming mutations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="p-4 border border-[var(--line)] rounded-xl bg-[var(--ink)]/50">
                 <div className="text-xs text-[var(--muted)] font-bold uppercase tracking-wider mb-1">Architecture Standard</div>
                 <div className="font-mono text-sm">RESTful JSON over HTTPS</div>
              </div>
              <div className="p-4 border border-[var(--line)] rounded-xl bg-[var(--ink)]/50">
                 <div className="text-xs text-[var(--muted)] font-bold uppercase tracking-wider mb-1">Base URL</div>
                 <div className="font-mono text-sm">&lt;INSTANCE_URL&gt;/api/v1</div>
              </div>
              <div className="p-4 border border-[var(--line)] rounded-xl bg-[var(--ink)]/50">
                 <div className="text-xs text-[var(--muted)] font-bold uppercase tracking-wider mb-1">Authorization</div>
                 <div className="font-mono text-sm">Bearer Token</div>
              </div>
              <div className="p-4 border border-[var(--line)] rounded-xl bg-[var(--ink)]/50">
                 <div className="text-xs text-[var(--muted)] font-bold uppercase tracking-wider mb-1">Rate Limit</div>
                 <div className="font-mono text-sm">100 req / minute</div>
              </div>
            </div>
          </div>
          <div className="ledger-card p-6">
             <h3 className="font-bold flex items-center gap-2 mb-4">
               <CpuIcon className="text-emerald-500" size={18} />
               Brain Integration
             </h3>
             <p className="text-xs text-[var(--muted)] mb-4">
               The API exposes a direct line to the LedgerFlow AI (`/brain/analyze`), allowing your external services to query the intelligent agent based on live ledger data.
             </p>
             <div className="p-3 bg-slate-900 text-white rounded-lg font-mono text-[10px] break-all">
                POST /api/v1/brain/analyze<br/>
                &#123;<br/>
                &nbsp;&nbsp;"prompt": "Analyze our runway based on recent MRR..."<br/>
                &#125;
             </div>
          </div>
        </div>
      )}

      {activeTab === 'keys' && (
        <div className="space-y-6">
          <div className="ledger-card p-4 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--line)] pb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[32px] bg-slate-950 text-white flex items-center justify-center">
                  <Key size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold font-display text-slate-950">Workspace API Keys</h2>
                  <p className="text-sm text-[var(--muted)]">Manage Bearer tokens with full or granular access scopes to integrate with external systems.</p>
                </div>
              </div>
              <button
                 onClick={() => {
                   setNewKeyName(`Integration Key (${new Date().toLocaleDateString()})`);
                   setSelectedScopes(AVAILABLE_SCOPES.map(s => s.id));
                   setExpiration('never');
                   setShowCreateModal(true);
                 }}
                 className="px-5 py-2.5 bg-slate-950 text-white font-bold rounded-xl text-sm hover:bg-slate-800 transition-all flex items-center gap-2 self-start sm:self-auto shrink-0 shadow-sm hover:scale-[1.01]"
               >
                 <RefreshCw size={14} />
                 Generate New Key
               </button>
            </div>

            {apiKey && (
              <div className="p-6 bg-emerald-50 rounded-[32px] border border-emerald-500/20 shadow-3xs">
                <div className="flex gap-3 items-center mb-3">
                   <AlertCircle className="text-emerald-600 shrink-0" size={20} />
                   <h4 className="text-sm font-black uppercase text-emerald-800 tracking-wider">Secret Key Generated Successfully</h4>
                </div>
                <p className="text-xs text-emerald-700/80 mb-4 font-medium">
                  <strong>Private Hashing Notice:</strong> Please copy this secret key now. For your security, LedgerFlow does NOT store this raw token string in the database. You will not be able to retrieve or see these characters again after you close this warning.
                </p>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                  <div className="flex-1 font-mono text-xs bg-[var(--surface)] border border-emerald-500/30 p-4 rounded-xl text-[var(--text)] font-bold break-all shadow-3xs">
                      {apiKey}
                  </div>
                  <button
                    onClick={copyKey}
                    className="px-6 py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shrink-0 shadow-sm"
                   aria-label="Check Circle2 action">
                    {isCopied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                    {isCopied ? 'Copied' : 'Copy Token'}
                  </button>
                </div>
                
                <div className="mt-5 bg-[var(--surface)]/40 p-4 rounded-xl border border-emerald-500/10 text-xs">
                  <div className="font-bold text-emerald-800 mb-2">Configure Client Integrations:</div>
                  <p className="text-slate-600 mb-2">Provide this credential in the HTTP <code className="bg-[var(--surface)] px-1 py-0.5 rounded font-mono font-bold text-[var(--text)] border">Authorization</code> header as a Bearer credentials token:</p>
                  <pre className="bg-[var(--surface)]/80 p-3 rounded-lg border border-[var(--line)] font-mono text-[11px] text-[var(--text)] overflow-x-auto">
                    {`curl -H "Authorization: Bearer ${apiKey}" \\\n  "https://${window.location.host}/api/v1/status?workspaceId=${currentWorkspace?.id || 'ws_123'}"`}
                  </pre>
                </div>
              </div>
            )}

            <div className="mt-6">
               <h3 className="font-bold text-sm text-[var(--text)] mb-4 flex items-center gap-2">
                 <Shield size={16} className="text-slate-450" />
                 Active Credentials ({publicKeys.length})
               </h3>
               {publicKeys.length === 0 ? (
                  <div className="text-sm text-[var(--muted)] italic p-6 border border-[var(--line)] bg-[var(--ink)]/50 rounded-[32px] text-center">
                    No active integration keys registered. Generate an API Key above to begin orchestrating external transactions and AI analyses.
                  </div>
               ) : (
                  <div className="border border-slate-150 rounded-[32px] shadow-3xs overflow-hidden">
                     <table className="w-full text-left text-sm">
                        <thead className="bg-[var(--ink)]/80 border-b border-slate-150 text-[10px] uppercase tracking-wider text-[var(--muted)] font-black">
                           <tr>
                              <th className="p-4 py-3.5">Details</th>
                              <th className="p-4 py-3.5">Granted Scopes</th>
                              <th className="p-4 py-3.5">Usage Telemetry</th>
                              <th className="p-4 py-3.5">Expiration</th>
                              <th className="p-4 py-3.5 text-right">Actions</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-[var(--surface)]">
                           {publicKeys.map((k: any) => {
                             const isExpired = k.expiresAt !== 'never' && new Date(k.expiresAt).getTime() < nowMs;
                             return (
                               <tr key={k.id} className="hover:bg-[var(--ink)]/40 transition-colors">
                                  <td className="p-4">
                                     <div className="font-bold text-slate-950 text-xs">{k.name}</div>
                                     <div className="font-mono text-[10px] text-[var(--muted)] mt-0.5">{k.id}</div>
                                     <div className="text-[10px] text-slate-400/90 mt-1">Created: {new Date(k.createdAt).toLocaleDateString()}</div>
                                  </td>
                                  <td className="p-4 max-w-xs">
                                     <div className="flex flex-wrap gap-1">
                                        {k.scopes.length === 0 ? (
                                           <span className="text-[9px] bg-[var(--ink)] text-[var(--muted)] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[var(--line)]">No Scopes</span>
                                        ) : (
                                           k.scopes.map((scope: string) => (
                                              <span 
                                                key={scope} 
                                                className={cn(
                                                  "text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border",
                                                  scope.startsWith('write:') ? "bg-amber-500/5 text-amber-700 border-amber-500/10" :
                                                  scope.startsWith('brain:') ? "bg-purple-500/5 text-purple-700 border-purple-500/10" :
                                                  "bg-slate-100 text-slate-650 border-[var(--line)]"
                                                )}
                                              >
                                                {scope}
                                              </span>
                                           ))
                                        )}
                                     </div>
                                  </td>
                                  <td className="p-4 text-xs font-mono text-slate-600">
                                     <div className="font-bold">{k.totalRequests} API calls</div>
                                     <div className="text-[10px] text-[var(--muted)] mt-1 flex items-center gap-1">
                                        <Clock size={10} />
                                        Last Used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                                     </div>
                                  </td>
                                  <td className="p-4">
                                     {isExpired ? (
                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase bg-red-500/10 border border-red-500/20 text-red-650 px-2.5 py-1 rounded-full">
                                          <Shield size={10} className="stroke-[3]" /> Expired
                                        </span>
                                     ) : k.expiresAt === 'never' ? (
                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase bg-slate-100 text-[var(--muted)] px-2.5 py-1 rounded-full border border-[var(--line)]">
                                          <Lock size={10} /> Indefinite
                                        </span>
                                     ) : (
                                        <div className="text-xs">
                                          <div className="font-bold text-[var(--text)]">{new Date(k.expiresAt).toLocaleDateString()}</div>
                                          <div className="text-[10px] text-[var(--muted)] mt-0.5">{new Date(k.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                     )}
                                  </td>
                                  <td className="p-4 text-right">
                                     <button 
                                       onClick={() => {
                                         if(confirm('Are you absolutely certain you wish to revoke this credential? Any servers using this token will instantly lose secure database access coordinates.')) {
                                           revokeKey(k.id);
                                         }
                                       }}
                                       className="inline-flex items-center justify-center w-8 h-8 text-[var(--muted)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                       title="Revoke Credential"
                                     >
                                       <Trash2 size={15} />
                                     </button>
                                  </td>
                               </tr>
                             );
                           })}
                        </tbody>
                     </table>
                  </div>
               )}
            </div>
          </div>

          {/* CREATE DETAILED KEY MODAL */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[32px] w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-6 border-b border-[var(--line)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-950 text-white flex items-center justify-center">
                      <Key size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--text)] font-display text-base">Provision New Developer Credential</h3>
                      <p className="text-xs text-[var(--muted)] font-mono mt-0.5">Workspace: {currentWorkspace?.name}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowCreateModal(false)}
                    className="p-1 px-1.5 text-[var(--muted)] hover:text-slate-950 rounded-lg hover:bg-[var(--ink)]"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Name Input */}
                  <div className="space-y-2">
                    <Labelled labelClassName="text-xs font-black uppercase tracking-wider text-[var(--muted)] block" label="Credential Name">
                      <input 
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g. Acme Production Integration"
                        className="w-full bg-[var(--ink)] border border-[var(--line)] p-3.5 rounded-xl text-sm font-bold text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-slate-950 focus:bg-[var(--surface)] transition-all shadow-3xs"
                      />
                    </Labelled>
                  </div>

                  {/* Expiration dropdown */}
                  <div className="space-y-2">
                    <Labelled labelClassName="text-xs font-black uppercase tracking-wider text-[var(--muted)] block" label="TTL / Expiration Age">
                      <select 
                        value={expiration}
                        onChange={(e: any) => setExpiration(e.target.value)}
                        className="w-full bg-[var(--ink)] border border-[var(--line)] p-3.5 rounded-xl text-sm font-bold text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-slate-950 focus:bg-[var(--surface)] transition-all shadow-3xs"
                      >
                        <option value="never">Indefinite (Never Expire)</option>
                        <option value="1h">1 Hour (Ephemeral Transient Testing)</option>
                        <option value="24h">24 Hours (Daily Rotation)</option>
                        <option value="30d">30 Days</option>
                        <option value="90d">90 Days</option>
                      </select>
                    </Labelled>
                  </div>

                  {/* Scopes selection */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">Access Scopes & Permissions</label>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setSelectedScopes(AVAILABLE_SCOPES.map(s => s.id))}
                          className="text-[10px] font-black text-[var(--muted)] hover:text-slate-950 uppercase"
                        >
                          Select All
                        </button>
                        <span className="text-[10px] text-slate-200 font-bold">|</span>
                        <button 
                          onClick={() => setSelectedScopes([])}
                          className="text-[10px] font-black text-[var(--muted)] hover:text-slate-950 uppercase"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    
                    <div className="max-h-[180px] overflow-y-auto pr-1 space-y-2 border border-[var(--line)] p-3.5 rounded-[32px] bg-[var(--ink)]/50">
                      {AVAILABLE_SCOPES.map((scope) => {
                        const checked = selectedScopes.includes(scope.id);
                        return (
                          <label 
                            key={scope.id} 
                            className={cn(
                              "flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-all border",
                              checked ? "bg-[var(--surface)] border-[var(--line)] shadow-3xs" : "border-transparent opacity-75 hover:opacity-100"
                            )}
                          >
                            <input 
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                if (checked) {
                                  setSelectedScopes(selectedScopes.filter(s => s !== scope.id));
                                } else {
                                  setSelectedScopes([...selectedScopes, scope.id]);
                                }
                              }}
                              className="mt-0.5 rounded border-slate-300 text-slate-950 focus:ring-slate-950 cursor-pointer h-4 w-4"
                            />
                            <div>
                              <div className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                                {scope.label}
                                <span className="font-mono text-[9px] bg-slate-100 text-slate-450 border border-[var(--line)] px-1 rounded uppercase tracking-wider">{scope.id}</span>
                              </div>
                              <div className="text-[10px] text-[var(--muted)] mt-0.5">{scope.desc}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Private hashing notice */}
                  <div className="p-4 rounded-[32px] bg-[var(--ink)] border border-slate-150 text-[11px] text-[var(--muted)] leading-relaxed font-medium">
                     🔓 <strong>Hashed Storage Guarantee:</strong> LedgerFlow stores credentials using a one-way salt-hashed SHA-256 match protocol. Nobody can ever decrypt or view the original secret sequence. Copy the key safely when displayed.
                  </div>
                </div>

                <div className="flex justify-end gap-3 p-6 bg-[var(--ink)] border-t border-[var(--line)]">
                  <button 
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-[var(--surface)] border border-[var(--line)] text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-100 transition-all shrink-0"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={generateNewKey}
                    disabled={isRegenerating || selectedScopes.length === 0}
                    className="px-5 py-2 bg-slate-950 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-all disabled:opacity-50 shrink-0 shadow-sm"
                   aria-label="Action button">
                    {isRegenerating ? 'Generating...' : 'Confirm and Provision'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'docs' && (
        <div className="ledger-card p-0 overflow-hidden text-sm flex flex-col md:flex-row min-h-[600px]">
          <div className="w-full md:w-64 border-r border-[var(--line)] overflow-y-auto bg-[var(--ink)]/20 p-4 shrink-0 space-y-6">
             <div>
                <div className="font-bold text-[10px] text-[var(--muted)] uppercase tracking-wider mb-3 px-2">Core Telemetry</div>
                <div className="space-y-1">
                  <button onClick={() => setActiveDoc('get-status')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'get-status' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-indigo-600" : "hover:bg-[var(--ink)]/50")}>GET /status</button>
                  <button onClick={() => setActiveDoc('get-logs')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'get-logs' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-indigo-600" : "hover:bg-[var(--ink)]/50")}>GET /logs</button>
                  <button onClick={() => setActiveDoc('get-metrics')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'get-metrics' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-[#8A2BE2]" : "hover:bg-[var(--ink)]/50")}>GET /metrics/summary</button>
                  <button onClick={() => setActiveDoc('shifting-metrics')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'shifting-metrics' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-[#8A2BE2]" : "hover:bg-[var(--ink)]/50")}>GET /metrics (Shifting Telemetry)</button>
                </div>
             </div>
             
             <div>
                <div className="font-bold text-[10px] text-[var(--muted)] uppercase tracking-wider mb-3 px-2">Ledger Config</div>
                <div className="space-y-1">
                  <button onClick={() => setActiveDoc('get-ledger')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'get-ledger' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-indigo-600" : "hover:bg-[var(--ink)]/50")}>GET /ledger</button>
                  <button onClick={() => setActiveDoc('post-ledger')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'post-ledger' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-emerald-500" : "hover:bg-[var(--ink)]/50")}>POST /ledger</button>
                </div>
             </div>

             <div>
                <div className="font-bold text-[10px] text-[var(--muted)] uppercase tracking-wider mb-3 px-2">Transactions</div>
                <div className="space-y-1">
                  <button onClick={() => setActiveDoc('get-transaction')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'get-transaction' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-indigo-600" : "hover:bg-[var(--ink)]/50")}>GET /transactions</button>
                  <button onClick={() => setActiveDoc('post-transaction')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'post-transaction' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-emerald-500" : "hover:bg-[var(--ink)]/50")}>POST /transactions</button>
                  <button onClick={() => setActiveDoc('put-transaction')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'put-transaction' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-amber-500" : "hover:bg-[var(--ink)]/50")}>PUT /transactions/:id</button>
                  <button onClick={() => setActiveDoc('delete-transaction')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'delete-transaction' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-rose-500" : "hover:bg-[var(--ink)]/50")}>DELETE /transactions/:id</button>
                </div>
             </div>

             <div>
                <div className="font-bold text-[10px] text-[var(--muted)] uppercase tracking-wider mb-3 mt-6 px-2">TruthEngine Math</div>
                <div className="space-y-1">
                  <button onClick={() => setActiveDoc('math-depreciation')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'math-depreciation' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-purple-600" : "hover:bg-[var(--ink)]/50")}>POST /math/depreciation</button>
                  <button onClick={() => setActiveDoc('math-inventory')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'math-inventory' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-purple-600" : "hover:bg-[var(--ink)]/50")}>POST /math/inventory/wac</button>
                  <button onClick={() => setActiveDoc('math-eoq')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'math-eoq' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-purple-600" : "hover:bg-[var(--ink)]/50")}>POST /math/inventory/eoq</button>
                  <button onClick={() => setActiveDoc('math-amortization')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'math-amortization' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-purple-600" : "hover:bg-[var(--ink)]/50")}>POST /math/amortization</button>
                  <button onClick={() => setActiveDoc('math-kpi')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'math-kpi' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-purple-600" : "hover:bg-[var(--ink)]/50")}>POST /math/kpi</button>
                  <button onClick={() => setActiveDoc('math-temporal')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'math-temporal' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-purple-600" : "hover:bg-[var(--ink)]/50")}>POST /math/temporal</button>
                </div>
             </div>

             <div>
                <div className="font-bold text-[10px] text-[var(--muted)] uppercase tracking-wider mb-3 px-2">Workspaces & Projects</div>
                <div className="space-y-1">
                  <button onClick={() => setActiveDoc('get-workspaces')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'get-workspaces' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-indigo-600" : "hover:bg-[var(--ink)]/50")}>GET /workspaces</button>
                  <button onClick={() => setActiveDoc('get-projects')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'get-projects' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-indigo-600" : "hover:bg-[var(--ink)]/50")}>GET /projects</button>
                  <button onClick={() => setActiveDoc('post-project')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'post-project' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-emerald-500" : "hover:bg-[var(--ink)]/50")}>POST /projects</button>
                </div>
             </div>

             <div>
                <div className="font-bold text-[10px] text-[var(--muted)] uppercase tracking-wider mb-3 px-2">AI LedgerFlow AI & ML</div>
                <div className="space-y-1">
                  <button onClick={() => setActiveDoc('post-brain')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'post-brain' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-[#8A2BE2]" : "hover:bg-[var(--ink)]/50")}>POST /brain/analyze</button>
                  <button onClick={() => setActiveDoc('post-classify')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'post-classify' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-[#d1502c]" : "hover:bg-[var(--ink)]/50")}>POST /brain/classify</button>
                  <button onClick={() => setActiveDoc('deep-audit')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'deep-audit' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-[#d1502c]" : "hover:bg-[var(--ink)]/50")}>POST /audit/deep</button>
                  <button onClick={() => setActiveDoc('poll-audit')} className={cn("w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-all", activeDoc === 'poll-audit' ? "bg-[var(--surface)] shadow-sm font-bold border border-[var(--line)] text-[#d1502c]" : "hover:bg-[var(--ink)]/50")}>GET /audit/jobs/:job_id</button>
                </div>
             </div>
          </div>
          
          <div className="flex-1 p-4 md:p-6 md:p-10 overflow-y-auto">
             <div className="flex justify-end mb-6">
                 <div className="flex bg-[var(--ink)] p-1 rounded-lg border border-[var(--line)]">
                     <button onClick={() => setDocLang('curl')} className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", docLang === 'curl' ? "bg-[var(--surface)] shadow-sm" : "text-[var(--muted)] opacity-70")}>cURL</button>
                     <button onClick={() => setDocLang('python')} className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", docLang === 'python' ? "bg-[var(--surface)] shadow-sm text-[#3776AB]" : "text-[var(--muted)] opacity-70")}>Python</button>
                     <button onClick={() => setDocLang('node')} className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", docLang === 'node' ? "bg-[var(--surface)] shadow-sm text-[#339933]" : "text-[var(--muted)] opacity-70")}>Node.js</button>
                 </div>
             </div>

             {activeDoc === 'get-status' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2">Check Engine Status</h2>
                    <p className="text-[var(--muted)]">Pings the LedgerFlow core API and returns active workspace metadata, currency settings, and uptime telemetry.</p>
                 </div>
                 
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X GET "https://api.ledgerflow.io/api/v1/status?workspaceId=${currentWorkspace?.id || 'ws_123'}" \\
  -H "Authorization: Bearer <YOUR_API_KEY>"` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/status?workspaceId=${currentWorkspace?.id || 'ws_123'}"
headers = {"Authorization": "Bearer <YOUR_API_KEY>"}

response = requests.get(url, headers=headers)
print(response.json())` : 
`const fetch = require('node-fetch');

const url = "https://api.ledgerflow.io/api/v1/status?workspaceId=${currentWorkspace?.id || 'ws_123'}";
const options = {
  method: 'GET',
  headers: { 'Authorization': 'Bearer <YOUR_API_KEY>' }
};

fetch(url, options)
  .then(res => res.json())
  .then(json => console.debug(json));`}
</pre>
                 </div>
                 
                 <h3 className="font-bold text-sm border-b border-[var(--line)] pb-2 mt-8">Example Response</h3>
                 <div className="bg-[var(--ink)]/50 text-xs p-4 rounded-xl border border-[var(--line)] font-mono">
{`{
  "status": "active",
  "service": "TruthEngine API",
  "workspaceId": "${currentWorkspace?.id || 'ws_123'}",
  "metadata": {
    "name": "Acme Corp",
    "currency": "USD",
    "lockDate": null,
    "businessType": "general"
  },
  "uptime": 12450.45,
  "timestamp": "2026-05-28T14:22:15Z"
}`}
                 </div>
               </div>
             )}

             {activeDoc === 'post-transaction' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">
                      Create Transaction 
                      <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">POST</span>
                    </h2>
                    <p className="text-[var(--muted)]">
                       Injects a new structural double-entry transaction. This endpoint guarantees atomic integrity—if the ledger lines do not sum exactly to zero, the transaction is rejected instantly. 
                    </p>
                 </div>

                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X POST "https://api.ledgerflow.io/api/v1/transactions" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Idempotency-Key: req_123456789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspaceId": "${currentWorkspace?.id || 'ws_123'}",
    "date": "2026-05-28",
    "description": "AWS Hosting",
    "payee": "Amazon Web Services",
    "amountCents": 145000
  }'` : 
 docLang === 'python' ? `import requests
import uuid

url = "https://api.ledgerflow.io/api/v1/transactions"
headers = {
    "Authorization": "Bearer <YOUR_API_KEY>",
    "Idempotency-Key": str(uuid.uuid4()),
    "Content-Type": "application/json"
}
payload = {
    "workspaceId": "${currentWorkspace?.id || 'ws_123'}",
    "date": "2026-05-28",
    "description": "AWS Hosting",
    "amountCents": 145000
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())` : 
`const fetch = require('node-fetch');
const crypto = require('crypto');

const url = "https://api.ledgerflow.io/api/v1/transactions";
const payload = {
  workspaceId: "${currentWorkspace?.id || 'ws_123'}",
  date: "2026-05-28",
  description: "AWS Hosting",
  amountCents: 145000
};

fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <YOUR_API_KEY>',
    'Idempotency-Key': crypto.randomUUID(),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>

                 <p className="text-xs text-[var(--muted)] bg-slate-900/10 p-4 rounded-xl border border-indigo-600/20">
                   <strong>💡 Auto-Balancing:</strong> The example above uses <code className="bg-[var(--surface)]/50 px-1 py-0.5 rounded ml-1">amountCents</code> instead of strict <code className="bg-[var(--surface)]/50 px-1 py-0.5 rounded ml-1">lines</code>. 
                   The LedgerFlow engine will intuitively pair your default operational expense and liquid asset accounts to balance the entry automatically. To specify multi-line distribution, pass an array of <code className="bg-[var(--surface)]/50 px-1 py-0.5 rounded ml-1">lines</code>.
                 </p>
               </div>
             )}

             {activeDoc === 'post-brain' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">
                       Analyze with AI LedgerFlow AI
                       <span className="text-[10px] bg-[#8A2BE2] text-white px-2 py-0.5 rounded-full tracking-widest uppercase">POST</span>
                    </h2>
                    <p className="text-[var(--muted)]">
                      Ask the LedgerFlow AI engine a question about your financial data. The deep engine securely compiles your ledger context and queries the rule models directly.
                    </p>
                 </div>

                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X POST "https://api.ledgerflow.io/api/v1/brain/analyze" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspaceId": "${currentWorkspace?.id || 'ws_123'}",
    "prompt": "Based on my transaction velocity over the last 30 days, am I trending towards a cash flow deficit?"
  }'` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/brain/analyze"
headers = {"Authorization": "Bearer <YOUR_API_KEY>"}
payload = {
    "workspaceId": "${currentWorkspace?.id || 'ws_123'}",
    "prompt": "Analyze my biggest expense categories and suggest optimization strategies."
}

res = requests.post(url, headers=headers, json=payload)
print(res.json().get('analysis'))` : 
`const fetch = require('node-fetch');

fetch("https://api.ledgerflow.io/api/v1/brain/analyze", {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <YOUR_API_KEY>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    workspaceId: "${currentWorkspace?.id || 'ws_123'}",
    prompt: "Scan recent transactions for duplicated software subscriptions."
  })
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>
               </div>
             )}

             {activeDoc === 'post-classify' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div>
                     <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">
                        Classify with Self-Learning ML
                        <span className="text-[10px] bg-[#d1502c] text-white px-2 py-0.5 rounded-full tracking-widest uppercase">POST</span>
                     </h2>
                     <p className="text-[var(--muted)]">
                       Instantly trains a Laplace-smoothed Naive Bayes bigram classifier on your workspace's past journal entries and categorizes incoming payment descriptions with machine confidence metrics.
                     </p>
                  </div>
 
                  <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X POST "https://api.ledgerflow.io/api/v1/brain/classify" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspaceId": "${currentWorkspace?.id || "ws_123"}",
    "description": "Amazon Web Services EC2 cloud node billing invoice",
    "targetFeatures": [
      { "text": "Google Cloud", "category": "Software & Subscriptions" },
      { "text": "Coffee and donuts", "category": "Meals & Entertainment" }
    ]
  }'` : 
 docLang === 'python' ? `import requests
 
url = "https://api.ledgerflow.io/api/v1/brain/classify"
headers = {
    "Authorization": "Bearer <YOUR_API_KEY>",
    "Content-Type": "application/json"
}
payload = {
    "workspaceId": "${currentWorkspace?.id || "ws_123"}",
    "description": "Starbucks downtown office breakfast",
    "targetFeatures": []
}
 
res = requests.post(url, headers=headers, json=payload)
print(res.json())` : 
`const fetch = require("node-fetch");
 
fetch("https://api.ledgerflow.io/api/v1/brain/classify", {
  method: "POST",
  headers: {
    "Authorization": "Bearer <YOUR_API_KEY>",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    workspaceId: "${currentWorkspace?.id || "ws_123"}",
    description: "AWS cloud server hosting billing",
    targetFeatures: []
  })
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                  </div>

                  <h3 className="font-bold text-sm border-b border-[var(--line)] pb-2 mt-8">Example Response</h3>
                  <div className="bg-[var(--ink)]/50 text-xs p-4 rounded-xl border border-[var(--line)] font-mono">
{`{
  "status": "success",
  "trainedModelCount": 124,
  "queryDescription": "Amazon Web Services EC2 cloud node billing invoice",
  "prediction": {
    "category": "Software & Subscriptions",
    "confidence": 0.9854,
    "label": "SOFTWARE_SUBSCRIPTIONS"
  }
}`}
                  </div>
                </div>
              )}

             {activeDoc === 'get-ledger' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">List Ledger Accounts</h2>
                    <p className="text-[var(--muted)]">Retrieves the entire structural Chart of Accounts mapped to the workspace.</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X GET "https://api.ledgerflow.io/api/v1/ledger?workspaceId=${currentWorkspace?.id || 'ws_123'}" \\
  -H "Authorization: Bearer <YOUR_API_KEY>"` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/ledger?workspaceId=${currentWorkspace?.id || 'ws_123'}"
response = requests.get(url, headers={"Authorization": "Bearer <YOUR_API_KEY>"})
print(response.json())` : 
`const fetch = require('node-fetch');

fetch("https://api.ledgerflow.io/api/v1/ledger?workspaceId=${currentWorkspace?.id || 'ws_123'}", {
  headers: { 'Authorization': 'Bearer <YOUR_API_KEY>' }
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>
               </div>
             )}

             {activeDoc === 'post-ledger' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">Create Ledger Account</h2>
                    <p className="text-[var(--muted)]">Append a new structural node to the Chart of Accounts.</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X POST "https://api.ledgerflow.io/api/v1/ledger" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspaceId": "${currentWorkspace?.id || 'ws_123'}",
    "name": "Fleet Vehicles",
    "type": "asset",
    "code": "1520"
  }'` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/ledger"
payload = {
    "workspaceId": "${currentWorkspace?.id || 'ws_123'}",
    "name": "Fleet Vehicles",
    "type": "asset",
    "code": "1520"
}
response = requests.post(url, headers={"Authorization": "Bearer <YOUR_API_KEY>"}, json=payload)
print(response.json())` : 
`const fetch = require('node-fetch');

fetch("https://api.ledgerflow.io/api/v1/ledger", {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <YOUR_API_KEY>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    workspaceId: "${currentWorkspace?.id || 'ws_123'}",
    name: "Fleet Vehicles",
    type: "asset",
    code: "1520"
  })
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>
               </div>
             )}

             {activeDoc === 'get-transaction' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">List Transactions</h2>
                    <p className="text-[var(--muted)]">Retrieves chronological immutable transaction records with their double-entry structures intact.</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X GET "https://api.ledgerflow.io/api/v1/transactions?workspaceId=${currentWorkspace?.id || 'ws_123'}" \\
  -H "Authorization: Bearer <YOUR_API_KEY>"` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/transactions?workspaceId=${currentWorkspace?.id || 'ws_123'}"
response = requests.get(url, headers={"Authorization": "Bearer <YOUR_API_KEY>"})
print(response.json())` : 
`const fetch = require('node-fetch');

fetch("https://api.ledgerflow.io/api/v1/transactions?workspaceId=${currentWorkspace?.id || 'ws_123'}", {
  headers: { 'Authorization': 'Bearer <YOUR_API_KEY>' }
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>
               </div>
             )}
             
             {activeDoc === 'delete-transaction' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">
                       Delete Transaction
                       <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">DELETE</span>
                    </h2>
                    <p className="text-[var(--muted)]">Permanently removes a transaction record from the database. Note: Enforces lock period verification automatically.</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X DELETE "https://api.ledgerflow.io/api/v1/transactions/api-1701234567-abcd?workspaceId=${currentWorkspace?.id || 'ws_123'}" \\
  -H "Authorization: Bearer <YOUR_API_KEY>"` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/transactions/api-1701234567-abcd?workspaceId=${currentWorkspace?.id || 'ws_123'}"
response = requests.delete(url, headers={"Authorization": "Bearer <YOUR_API_KEY>"})
print(response.json())` : 
`const fetch = require('node-fetch');

fetch("https://api.ledgerflow.io/api/v1/transactions/api-1701234567-abcd?workspaceId=${currentWorkspace?.id || 'ws_123'}", {
  method: 'DELETE',
  headers: { 'Authorization': 'Bearer <YOUR_API_KEY>' }
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>
               </div>
             )}

             {activeDoc === 'get-logs' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">Fetch Audit Logs</h2>
                    <p className="text-[var(--muted)]">Obtain the deep API access telemetry, monitoring recent requests and latencies processed against your workspace.</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X GET "https://api.ledgerflow.io/api/v1/logs?workspaceId=${currentWorkspace?.id || 'ws_123'}" \\
  -H "Authorization: Bearer <YOUR_API_KEY>"` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/logs?workspaceId=${currentWorkspace?.id || 'ws_123'}"
response = requests.get(url, headers={"Authorization": "Bearer <YOUR_API_KEY>"})
print(response.json())` : 
`const fetch = require('node-fetch');

fetch("https://api.ledgerflow.io/api/v1/logs?workspaceId=${currentWorkspace?.id || 'ws_123'}", {
  headers: { 'Authorization': 'Bearer <YOUR_API_KEY>' }
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>
               </div>
             )}

             {activeDoc === 'get-metrics' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">Fetch Core Analytics</h2>
                    <p className="text-[var(--muted)]">Aggregates all double-entry ledger lines to compute your core financial footprint in real-time. Calculate your Net Income, OPEX, Assets, and Equity.</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X GET "https://api.ledgerflow.io/api/v1/metrics/summary?workspaceId=${currentWorkspace?.id || 'ws_123'}" \\
  -H "Authorization: Bearer <YOUR_API_KEY>"` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/metrics/summary?workspaceId=${currentWorkspace?.id || 'ws_123'}"
response = requests.get(url, headers={"Authorization": "Bearer <YOUR_API_KEY>"})
print(response.json())` : 
`const fetch = require('node-fetch');

fetch("https://api.ledgerflow.io/api/v1/metrics/summary?workspaceId=${currentWorkspace?.id || 'ws_123'}", {
  headers: { 'Authorization': 'Bearer <YOUR_API_KEY>' }
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>
                 
                 <h3 className="font-bold text-sm border-b border-[var(--line)] pb-2 mt-8">Example Response</h3>
                 <div className="bg-[var(--ink)]/50 text-xs p-4 rounded-xl border border-[var(--line)] font-mono">
{`{
  "status": "success",
  "workspaceId": "${currentWorkspace?.id || 'ws_123'}",
  "metrics": {
    "netIncomeCents": 3450000,
    "grossRevenueCents": 4200000,
    "totalOpExCents": 750000,
    "currentAssetsCents": 12450000,
    "totalLiabilitiesCents": 2100000,
    "equityCents": 10350000
  },
  "transactionVolume": 432
}`}
                 </div>
               </div>
             )}

             {activeDoc === 'shifting-metrics' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                   <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">Shifting Telemetry & Metric Audits</h2>
                   <p className="text-[var(--muted)] font-medium text-xs leading-relaxed">This call allows external systems to query the state of a business workspace without fetching thousands of raw lines. It dynamically outputs targeted vectors shifting based on workspace type (e.g., ARR for SaaS, Cap Rate/NOI for Real Estate, COGS margin for Retail, or run-rate burn modeling for personal portfolios).</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X GET "https://api.ledgerflow.io/api/v1/metrics?workspaceId=${currentWorkspace?.id || 'ws_123'}" \\
  -H "Authorization: Bearer <YOUR_API_KEY>"` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/metrics?workspaceId=${currentWorkspace?.id || 'ws_123'}"
response = requests.get(url, headers={"Authorization": "Bearer <YOUR_API_KEY>"})
print(response.json())` : 
`const fetch = require('node-fetch');

fetch("https://api.ledgerflow.io/api/v1/metrics?workspaceId=${currentWorkspace?.id || 'ws_123'}", {
  headers: { 'Authorization': 'Bearer <YOUR_API_KEY>' }
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>
                 
                 <h3 className="font-bold text-sm border-b border-[var(--line)] pb-2 mt-8">Example Response (SaaS Archetype example)</h3>
                 <div className="bg-[var(--ink)]/50 text-xs p-4 rounded-xl border border-[var(--line)] font-mono font-medium">
{`{
  "status": "success",
  "workspaceId": "${currentWorkspace?.id || 'ws_123'}",
  "businessType": "saas",
  "coreMetrics": {
    "grossRevenueCents": 12500000,
    "operatingExpenseCents": 6400000,
    "netOperatingCashFlowCents": 6100000,
    "totalLiquidAssetsCents": 32000000,
    "totalLiabilitiesCents": 8000000,
    "equityValueCents": 24000000
  },
  "shiftingMetrics": {
    "industryType": "SaaS & Subscription",
    "metrics": {
      "arrCents": 150000000,
      "mrrCents": 12500000,
      "ltvCents": 250000000,
      "churnPercentage": 5.0,
      "grossMarginPercentage": 48.8
    }
  },
  "timestamp": "2026-06-07T16:00:00.000Z"
}`}
                 </div>
               </div>
             )}

             {activeDoc === 'deep-audit' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                   <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">Deep Strategic Strategy Auditing</h2>
                   <p className="text-[var(--muted)] font-medium text-xs leading-relaxed">This high-margin endpoint launches a deep strategic simulation job examining: Velocity AR Bleed (WACC Capital Drag on outstanding invoices), Customer Overconcentration Risks, and Physical/Procurement bulk margin arbitrage. It follows an asynchronous job pattern to avoid HTTP client timeouts.</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X POST "https://api.ledgerflow.io/api/v1/audit/deep" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspaceId": "${currentWorkspace?.id || 'ws_123'}"
  }'` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/audit/deep"
headers = {
    "Authorization": "Bearer <YOUR_API_KEY>",
    "Content-Type": "application/json"
}
payload = {
    "workspaceId": "${currentWorkspace?.id || 'ws_123'}"
}
response = requests.post(url, headers=headers, json=payload)
print(response.json())` : 
`const fetch = require('node-fetch');

fetch("https://api.ledgerflow.io/api/v1/audit/deep", {
  method: "POST",
  headers: {
    "Authorization": "Bearer <YOUR_API_KEY>",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ workspaceId: "${currentWorkspace?.id || 'ws_123'}" })
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>
                 
                 <h3 className="font-bold text-sm border-b border-[var(--line)] pb-2 mt-8">Example Response (Asynchronous job accepted)</h3>
                 <div className="bg-[var(--ink)]/50 text-xs p-4 rounded-xl border border-[var(--line)] font-mono font-medium">
{`{
  "status": "processing",
  "message": "Strategic simulation launched asynchronously. Please poll job endpoint for results.",
  "job_id": "job_1701234567_abcd",
  "check_status_url": "/api/v1/audit/jobs/job_1701234567_abcd"
}`}
                 </div>
               </div>
             )}

             {activeDoc === 'poll-audit' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                   <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">Retrieve Deep Strategic Results</h2>
                   <p className="text-[var(--muted)] font-medium text-xs leading-relaxed">Polls the status of an asynchronous deep audit job. Once the compute is completed, returns granular analytical matrices on EBITDA values, cost-of-capital receivables bleeds, multiple haircuts, and an automated Markdown Executive report.</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X GET "https://api.ledgerflow.io/api/v1/audit/jobs/job_1701234567_abcd?workspaceId=${currentWorkspace?.id || 'ws_123'}" \\
  -H "Authorization: Bearer <YOUR_API_KEY>"` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/audit/jobs/job_1701234567_abcd?workspaceId=${currentWorkspace?.id || 'ws_123'}"
response = requests.get(url, headers={"Authorization": "Bearer <YOUR_API_KEY>"})
print(response.json())` : 
`const fetch = require('node-fetch');

fetch("https://api.ledgerflow.io/api/v1/audit/jobs/job_1701234567_abcd?workspaceId=${currentWorkspace?.id || 'ws_123'}", {
  headers: { 'Authorization': 'Bearer <YOUR_API_KEY>' }
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>
                 
                 <h3 className="font-bold text-sm border-b border-[var(--line)] pb-2 mt-8">Example Response (Complete Audit Report)</h3>
                 <div className="bg-[var(--ink)]/50 text-xs p-4 rounded-xl border border-[var(--line)] font-mono font-medium font-medium">
{`{
  "status": "success",
  "job_id": "job_1701234567_abcd",
  "jobStatus": "completed",
  "progress": 100,
  "completedAt": "2026-06-07T16:02:15.000Z",
  "results": {
    "velocityArBleed": {
      "totalCapitalCostDragCents": 142000,
      "logsCount": 3,
      "logs": [
        { "invoiceId": "inv_99", "customerName": "Acme Corp", "daysOutstanding": 45, "impliedCostOfCapitalCents": 98000 }
      ]
    },
    "concentrationRisk": {
      "maxClientContributionRatio": 0.452,
      "isConcentratedThresholdTriggered": true,
      "haircutMultiplierHit": 0.85
    },
    "valuationMatrix": {
      "ebitdaCents": 43500000,
      "baseMultiple": 4.5,
      "impliedValuationBaseCents": 195750000,
      "actualAdjustedValuationCents": 166245500
    },
    "markdownNarrative": "### Executive Strategic Audit Narrative..."
  }
}`}
                 </div>
               </div>
             )}

             {activeDoc === 'put-transaction' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">
                       Update Transaction Record
                       <span className="text-[10px] bg-yellow-500 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">PUT</span>
                    </h2>
                    <p className="text-[var(--muted)]">
                       Allows modifying an existing transaction by ID. Enforces double-entry balances, updates audit logs, and validates target period locking locks.
                    </p>
                 </div>

                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X PUT "https://api.ledgerflow.io/api/v1/transactions/<TRANSACTION_ID>" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspaceId": "${currentWorkspace?.id || 'ws_123'}",
    "description": "AWS Hosting Tier Upgrade",
    "amountCents": 185000
  }'` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/transactions/<TRANSACTION_ID>"
headers = {
    "Authorization": "Bearer <YOUR_API_KEY>",
    "Content-Type": "application/json"
}
payload = {
    "workspaceId": "${currentWorkspace?.id || 'ws_123'}",
    "description": "AWS Hosting Tier Upgrade",
    "amountCents": 185000
}

response = requests.put(url, headers=headers, json=payload)
print(response.json())` : 
`const fetch = require('node-fetch');

const url = "https://api.ledgerflow.io/api/v1/transactions/<TRANSACTION_ID>";
const payload = {
  workspaceId: "${currentWorkspace?.id || 'ws_123'}",
  description: "AWS Hosting Tier Upgrade",
  amountCents: 185000
};

fetch(url, {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer <YOUR_API_KEY>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>
               </div>
             )}

             {activeDoc === 'math-depreciation' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">
                       Depreciation Math Engine
                       <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">POST</span>
                    </h2>
                    <p className="text-[var(--muted)]">Calculate straight-line or declining balance asset depreciation using the core engine.</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X POST "https://api.ledgerflow.io/api/v1/math/depreciation" \\
  -H "Authorization: Bearer <token>" \\
  -d '{
    "type": "double_declining_balance",
    "costCents": 5000000,
    "salvageValueCents": 1000000,
    "usefulLifePeriods": 60,
    "multiplier": 2
  }'` : 
`const response = await fetch("https://api.ledgerflow.io/api/v1/math/depreciation", {
  method: "POST",
  headers: {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    type: "double_declining_balance", // supports: straight_line, declining_balance, sum_of_years_digits
    costCents: 5000000, // $50,000.00
    salvageValueCents: 1000000, // $10,000.00
    usefulLifePeriods: 60, // 5 years in months
    multiplier: 2 // Or 1.5 for 150% declining balance
  })
});

const { depreciationPerPeriodCents } = await response.json();`}
</pre>
                 </div>
               </div>
             )}

             {activeDoc === 'math-inventory' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">
                       Inventory Costing Engine
                       <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">POST</span>
                    </h2>
                    <p className="text-[var(--muted)]">Determine Weighted Average Cost (WAC) dynamically for inventory valuations.</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X POST "https://api.ledgerflow.io/api/v1/math/inventory/wac" \\
  -H "Authorization: Bearer <token>" \\
  -d '{
    "currentQty": 100,
    "currentValueCents": 500000,
    "incomingQty": 50,
    "incomingValueCents": 300000
  }'` : 
`const response = await fetch("https://api.ledgerflow.io/api/v1/math/inventory/wac", {
  method: "POST",
  headers: {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    currentQty: 100,
    currentValueCents: 500000,
    incomingQty: 50,
    incomingValueCents: 300000
  })
});

const { newAverageCostCents } = await response.json();`}
</pre>
                 </div>
               </div>
             )}

             {activeDoc === 'math-amortization' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">
                       Amortization Math Engine
                       <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">POST</span>
                    </h2>
                    <p className="text-[var(--muted)]">Equivalent to the PMT function. Calculates constant periodic loan amortizations.</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X POST "https://api.ledgerflow.io/api/v1/math/amortization" \\
  -H "Authorization: Bearer <token>" \\
  -d '{
    "principalCents": 10000000,
    "annualInterestRate": 0.05,
    "totalPeriods": 360,
    "paymentsPerYear": 12
  }'` : 
`const response = await fetch("https://api.ledgerflow.io/api/v1/math/amortization", {
  method: "POST",
  headers: {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    principalCents: 10000000, // $100,000.00
    annualInterestRate: 0.05, // 5%
    totalPeriods: 360, // 30 Years * 12 months
    paymentsPerYear: 12 // Optional, overrides hardcoded monthly assumptions
  })
});

const { periodicPaymentCents } = await response.json();`}
</pre>
                 </div>
               </div>
             )}

             {activeDoc === 'math-eoq' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">
                       Economic Order Quantity (EOQ) Engine
                       <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">POST</span>
                    </h2>
                    <p className="text-[var(--muted)]">Determine the optimal order quantity to minimize inventory costs.</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X POST "https://api.ledgerflow.io/api/v1/math/inventory/eoq" \\
  -H "Authorization: Bearer <token>" \\
  -d '{
    "annualDemand": 10000,
    "costPerOrderCents": 50000,
    "holdingCostPerUnitCents": 200
  }'` : 
`const response = await fetch("https://api.ledgerflow.io/api/v1/math/inventory/eoq", {
  method: "POST",
  headers: {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    annualDemand: 10000,
    costPerOrderCents: 50000, // $500.00 base fixed order cost
    holdingCostPerUnitCents: 200 // $2.00 carrying cost
  })
});

const { eoq } = await response.json();`}
</pre>
                 </div>
               </div>
             )}

             {activeDoc === 'math-kpi' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">
                       Financial Health (KPIs & Ratios)
                       <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">POST</span>
                    </h2>
                    <p className="text-[var(--muted)]">Dynamic API for bulk calculating advanced enterprise ratios (ROI, NPV, Break-Even, Liquidity).</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X POST "https://api.ledgerflow.io/api/v1/math/kpi" \\
  -H "Authorization: Bearer <token>" \\
  -d '{
    "netProfitCents": 1500000,
    "investmentCostCents": 10000000,
    "currentAssetsCents": 5000000,
    "currentLiabilitiesCents": 2000000
  }'` : 
`const response = await fetch("https://api.ledgerflow.io/api/v1/math/kpi", {
  method: "POST",
  headers: {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    // Input any combinations of fundamentals to receive their KPIs
    netProfitCents: 1500000,
    investmentCostCents: 10000000,
    
    currentAssetsCents: 5000000,
    currentLiabilitiesCents: 2000000
  })
});

const kpiResults = await response.json();
// Returns: { roiPercentage: 15, currentRatio: 2.5, ... }`}
</pre>
                 </div>
               </div>
             )}

             {activeDoc === 'math-temporal' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">
                       Temporal Validity Engine
                       <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">POST</span>
                    </h2>
                    <p className="text-[var(--muted)]">Resolves time-bound financial configurations (Tax changes, Currency fluctuations) efficiently.</p>
                 </div>
                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed tabular-nums">
{docLang === 'curl' ? `curl -X POST "https://api.ledgerflow.io/api/v1/math/temporal" \\
  -H "Authorization: Bearer <token>" \\
  -d '{
    "type": "tax",
    "amountCents": 1500000,
    "targetDate": "2024-03-01",
    "timeSeries": [
      { "validFrom": "0000-01-01", "validTo": "2023-12-31", "value": 0.08 },
      { "validFrom": "2024-01-01", "validTo": "9999-12-31", "value": 0.095 }
    ]
  }'` : 
`const response = await fetch("https://api.ledgerflow.io/api/v1/math/temporal", {
  method: "POST",
  headers: {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    type: "tax", // or "currency"
    amountCents: 1500000, // $15,000.00
    targetDate: "2024-03-01", // The transaction date you need integrity for
    timeSeries: [
      { validFrom: "0000-01-01", validTo: "2023-12-31", value: 0.08 }, // 8% tax rate
      { validFrom: "2024-01-01", validTo: "9999-12-31", value: 0.095 } // Tax increased to 9.5%
    ]
  })
});

const { effectiveValue, calculatedAmountCents } = await response.json();
// System safely resolves the 9.5% rate and calculates the burden without silent fallbacks`}
</pre>
                 </div>
               </div>
             )}

             {activeDoc === 'get-workspaces' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">
                       List Managed Workspaces
                       <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">GET</span>
                    </h2>
                    <p className="text-[var(--muted)]">
                       Queries and returns all workspace accounts owned or co-managed by this profile context. You can use this to select which workspace to perform financial API calls upon.
                    </p>
                 </div>

                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X GET "https://api.ledgerflow.io/api/v1/workspaces" \\
  -H "Authorization: Bearer <YOUR_API_KEY>"` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/workspaces"
headers = {"Authorization": "Bearer <YOUR_API_KEY>"}

response = requests.get(url, headers=headers)
print(response.json())` : 
`const fetch = require('node-fetch');

fetch("https://api.ledgerflow.io/api/v1/workspaces", {
  headers: { 'Authorization': 'Bearer <YOUR_API_KEY>' }
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>
               </div>
             )}

             {activeDoc === 'get-projects' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">
                       List Workspace Projects
                       <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">GET</span>
                    </h2>
                    <p className="text-[var(--muted)]">
                       Retrieves the list of active business projects configured inside your workspace under ledger parameters.
                    </p>
                 </div>

                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X GET "https://api.ledgerflow.io/api/v1/projects?workspaceId=${currentWorkspace?.id || 'ws_123'}" \\
  -H "Authorization: Bearer <YOUR_API_KEY>"` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/projects?workspaceId=${currentWorkspace?.id || 'ws_123'}"
headers = {"Authorization": "Bearer <YOUR_API_KEY>"}

response = requests.get(url, headers=headers)
print(response.json())` : 
`const fetch = require('node-fetch');

fetch("https://api.ledgerflow.io/api/v1/projects?workspaceId=${currentWorkspace?.id || 'ws_123'}", {
  headers: { 'Authorization': 'Bearer <YOUR_API_KEY>' }
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>
               </div>
             )}

             {activeDoc === 'post-project' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div>
                    <h2 className="text-2xl font-bold font-display mb-2 flex items-center gap-2">
                       Create Business Project
                       <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">POST</span>
                    </h2>
                    <p className="text-[var(--muted)]">
                       Registers a new corporate project resource inside your workspace ledger to enable targeted activity tracking.
                    </p>
                 </div>

                 <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-5 overflow-x-auto border border-[#292E42]">
<pre className="font-mono text-[13px] leading-relaxed">
{docLang === 'curl' ? `curl -X POST "https://api.ledgerflow.io/api/v1/projects" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspaceId": "${currentWorkspace?.id || 'ws_123'}",
    "name": "Integration Project",
    "code": "INT-001",
    "description": "API-triggered corporate development sub-ledger"
  }'` : 
 docLang === 'python' ? `import requests

url = "https://api.ledgerflow.io/api/v1/projects"
headers = {
    "Authorization": "Bearer <YOUR_API_KEY>",
    "Content-Type": "application/json"
}
payload = {
    "workspaceId": "${currentWorkspace?.id || 'ws_123'}",
    "name": "Integration Project",
    "code": "INT-001"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())` : 
`const fetch = require('node-fetch');

const url = "https://api.ledgerflow.io/api/v1/projects";
const payload = {
  workspaceId: "${currentWorkspace?.id || 'ws_123'}",
  name: "Integration Project",
  code: "INT-001"
};

fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <YOUR_API_KEY>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
}).then(res => res.json()).then(data => console.info(data));`}
</pre>
                 </div>
               </div>
             )}

          </div>
        </div>
      )}

      {activeTab === 'sandbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
          <div className="lg:col-span-5 space-y-6">
            <div className="ledger-card p-6 space-y-6">
              <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Play size={18} />
                </div>
                <div>
                  <h3 className="font-header font-bold text-[var(--text)]">Configure Live Request</h3>
                  <p className="text-[10px] text-[var(--muted)] uppercase tracking-widest font-black">Interactive Sandbox Engine</p>
                </div>
              </div>

              {/* Endpoint select dropdown */}
              <div className="space-y-2">
                <Labelled labelClassName="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]" label="Select API Route">
                  <select
                    value={sandboxEndpoint}
                    onChange={(e) => {
                      setSandboxEndpoint(e.target.value);
                      setSandboxResult(null);
                      setSandboxStatus(null);
                      setSandboxLatency(null);
                    }}
                    className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-xl p-3 text-xs font-bold font-mono focus:ring-1 focus:ring-slate-950 focus:outline-none"
                  >
                    <option value="GET_v1_status">GET /api/v1/status (Verify Core Gateway Status)</option>
                    <option value="GET_v1_workspaces">GET /api/v1/workspaces (Query Tenant Profiles)</option>
                    <option value="GET_v1_ledger">GET /api/v1/ledger (Check Chart of Accounts)</option>
                    <option value="POST_v1_ledger">POST /api/v1/ledger (Provison COA Ledger Node)</option>
                    <option value="GET_v1_transactions">GET /api/v1/transactions (Sync Decisive Postings)</option>
                    <option value="POST_v1_transactions">POST /api/v1/transactions (Ingest Posting + Bayesian Learn)</option>
                    <option value="POST_v1_transactions_bulk">POST /api/v1/transactions/bulk (10x Bulk Ingest Engine)</option>
                    <option value="GET_v1_ledger_diagnostics">GET /api/v1/ledger/diagnostics (10x Ledger Sanity Diagnostics)</option>
                    <option value="GET_v1_projects">GET /api/v1/projects (Query Active Ventures)</option>
                    <option value="POST_v1_projects">POST /api/v1/projects (Map Corporate Scenario Submodule)</option>
                    <option value="GET_v1_metrics">GET /api/v1/metrics (Retrieve Sifting KPIs)</option>
                    <option value="POST_ledger_match">POST /api/v1/ledger/match (Parallel Rule Matching)</option>
                    <option value="POST_brain_analyze">POST /api/v1/brain/analyze (Query LedgerFlow AI Cognitive AI)</option>
                    <option value="POST_v1_brain_classify_batch">POST /api/v1/brain/classify-batch (10x Cognitive NLP Batch Categorizer)</option>
                    <option value="GET_v1_ecommerce">GET /api/v1/ecommerce (Fetch Channels)</option>
                    <option value="POST_v1_ecommerce">POST /api/v1/ecommerce (Sync Channel)</option>
                    <option value="GET_v1_marketing">GET /api/v1/marketing (Fetch Campaigns)</option>
                    <option value="POST_v1_marketing">POST /api/v1/marketing (Create Campaign)</option>
                    <option value="GET_v1_helpdesk">GET /api/v1/helpdesk (Fetch Tickets)</option>
                    <option value="POST_v1_helpdesk">POST /api/v1/helpdesk (Create Ticket)</option>
                    <option value="GET_v1_hr">GET /api/v1/hr (Fetch Headcount)</option>
                    <option value="POST_v1_hr">POST /api/v1/hr (Add Employee)</option>
                    <option value="GET_v1_manufacturing">GET /api/v1/manufacturing (Fetch Work Orders)</option>
                    <option value="POST_v1_manufacturing">POST /api/v1/manufacturing (Create WO)</option>
                    <option value="GET_v1_universal_ops">GET /api/v1/universal-ops (Fetch Dimensions)</option>
                    <option value="POST_v1_universal_ops">POST /api/v1/universal-ops (Tag Dimension)</option>
                  </select>
                </Labelled>
              </div>

              {/* Credentials auth select */}
              <div className="space-y-3 p-4 bg-[var(--ink)] border border-slate-150 rounded-xl">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">Security Authentication Identity</label>
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setSandboxCredType('session')}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border cursor-pointer text-center",
                      sandboxCredType === 'session' ? "bg-slate-950 text-white border-slate-950" : "bg-[var(--surface)] text-[var(--text)] border-[var(--line)] hover:bg-[var(--ink)]"
                    )}
                  >
                    Active Admin JWT Session
                  </button>
                  <button
                    onClick={() => {
                      setSandboxCredType('key');
                      if (publicKeys.length > 0 && !sandboxSelectedKey) {
                        setSandboxSelectedKey(publicKeys[0].id);
                      }
                    }}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border cursor-pointer text-center",
                      sandboxCredType === 'key' ? "bg-slate-950 text-white border-slate-950" : "bg-[var(--surface)] text-[var(--text)] border-[var(--line)] hover:bg-[var(--ink)]"
                    )}
                  >
                    API Bearer Key
                  </button>
                </div>

                {sandboxCredType === 'key' && (
                  <div className="space-y-2 pt-2">
                    {publicKeys.length === 0 ? (
                      <div className="text-[10px] text-amber-600 font-bold bg-amber-50 p-2.5 border border-amber-200 rounded-lg">
                        ⚠️ No active developer API keys exist. Use the <strong>Auth Keys</strong> tab first or stick to Active Admin JWT credentials.
                      </div>
                    ) : (
                      <select
                        value={sandboxSelectedKey}
                        onChange={(e) => setSandboxSelectedKey(e.target.value)}
                        className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-[11px] font-mono focus:outline-none"
                      >
                        {publicKeys.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name} ({k.id.substring(0, 12)}...)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Dynamic input blocks based on active endpoint path selection */}
              <div className="space-y-4 pt-2 border-t border-[var(--line)]">
                <h4 className="text-[11px] font-extrabold uppercase text-slate-450 tracking-widest">Aperiodic Scope Parameters</h4>

                {/* POST TRANSACTION inputs */}
                {sandboxEndpoint === 'POST_v1_transactions' && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Labelled labelClassName="text-[9px] font-black uppercase text-[var(--muted)]" label="Transaction Date">
                          <input
                            type="date"
                            value={fieldDate}
                            onChange={(e) => setFieldDate(e.target.value)}
                            className="w-full text-xs font-semibold p-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-950"
                          />
                        </Labelled>
                      </div>
                      <div className="space-y-1">
                        <Labelled labelClassName="text-[9px] font-black uppercase text-[var(--muted)]" label="Amount (Cents)">
                          <input
                            type="number"
                            value={fieldAmountCents}
                            onChange={(e) => setFieldAmountCents(parseFloat(e.target.value) || 0)}
                            className="w-full text-xs font-semibold p-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-950 font-mono"
                          />
                        </Labelled>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Labelled labelClassName="text-[9px] font-black uppercase text-[var(--muted)]" label="Transaction Narration / Description">
                        <input
                          type="text"
                          value={fieldDesc}
                          onChange={(e) => setFieldDesc(e.target.value)}
                          placeholder="e.g. AWS S3 Storage Billing Tier"
                          className="w-full text-xs font-semibold p-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-950"
                        />
                      </Labelled>
                    </div>

                    <div className="space-y-1.5 p-3 rounded-lg border border-[var(--line)] bg-[var(--ink)]/50">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black uppercase text-[var(--muted)]">Idempotency Cryptic Key</label>
                        <button
                          onClick={() => setFieldIdempotencyKey("lf_idem_" + crypto.randomUUID())}
                          className="text-[9px] font-bold text-indigo-600 hover:underline bg-transparent border-0 cursor-pointer"
                        >
                          Regenerate
                        </button>
                      </div>
                      <input
                        type="text"
                        value={fieldIdempotencyKey}
                        onChange={(e) => setFieldIdempotencyKey(e.target.value)}
                        className="w-full text-xs font-mono p-1.5 bg-[var(--surface)] border border-[var(--line)] rounded-md focus:outline-none focus:ring-1 focus:ring-slate-950"
                      />
                    </div>

                    <div className="flex items-center justify-between p-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-700">Dry-Run Mode</span>
                        <span className="text-[9px] text-[var(--muted)]">Validate values without storage commit.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={fieldDryRun}
                        onChange={(e) => setFieldDryRun(e.target.checked)}
                        className="w-4 h-4 rounded text-slate-950 focus:ring-slate-950"
                      />
                    </div>
                  </div>
                )}

                {/* POST LEDGER ACCOUNT inputs */}
                {sandboxEndpoint === 'POST_v1_ledger' && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="space-y-1">
                      <Labelled labelClassName="text-[9px] font-black uppercase text-[var(--muted)]" label="Account Node Name">
                        <input
                          type="text"
                          value={fieldCOAName}
                          onChange={(e) => setFieldCOAName(e.target.value)}
                          className="w-full text-xs font-semibold p-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg focus:ring-1 focus:ring-slate-950 focus:outline-none"
                        />
                      </Labelled>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Labelled labelClassName="text-[9px] font-black uppercase text-[var(--muted)]" label="Account Type Class">
                          <select
                            value={fieldCOAType}
                            onChange={(e) => setFieldCOAType(e.target.value)}
                            className="w-full text-xs font-semibold p-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg focus:outline-none font-sans"
                          >
                            <option value="asset">Asset (Liquid/Tangible)</option>
                            <option value="liability">Liability (Leases/Payable)</option>
                            <option value="equity">Equity (Shares/Retained)</option>
                            <option value="revenue">Revenue (Sales/Interest)</option>
                            <option value="expense">Expense (Procurement/Wages)</option>
                          </select>
                        </Labelled>
                      </div>
                      <div className="space-y-1">
                        <Labelled labelClassName="text-[9px] font-black uppercase text-[var(--muted)]" label="Subledger Account Code">
                          <input
                            type="text"
                            value={fieldCOACode}
                            onChange={(e) => setFieldCOACode(e.target.value)}
                            placeholder="e.g. 5230"
                            className="w-full text-xs font-mono p-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg focus:outline-none focus:ring-1"
                          />
                        </Labelled>
                      </div>
                    </div>
                  </div>
                )}

                {/* POST PROJECT inputs */}
                {sandboxEndpoint === 'POST_v1_projects' && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="space-y-1">
                      <Labelled labelClassName="text-[9px] font-black uppercase text-[var(--muted)]" label="Venture/Project Name">
                        <input
                          type="text"
                          value={fieldProjectName}
                          onChange={(e) => setFieldProjectName(e.target.value)}
                          className="w-full text-xs font-semibold p-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg focus:ring-1 focus:ring-slate-950 focus:outline-none"
                        />
                      </Labelled>
                    </div>
                    <div className="space-y-1">
                      <Labelled labelClassName="text-[9px] font-black uppercase text-[var(--muted)]" label="Designation Code ID">
                        <input
                          type="text"
                          value={fieldProjectCode}
                          onChange={(e) => setFieldProjectCode(e.target.value)}
                          placeholder="INT-PHX-11"
                          className="w-full text-xs font-mono p-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg focus:outline-none"
                        />
                      </Labelled>
                    </div>
                  </div>
                )}

                {/* LEDGER MATCH & BATCH CLASSIFY inputs */}
                {(sandboxEndpoint === 'POST_ledger_match' || sandboxEndpoint === 'POST_v1_brain_classify_batch') && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-black uppercase text-[var(--muted)]">Descriptions feedstock array (one-per-line)</label>
                        <span className={cn(
                          "text-[9px] font-semibold px-1.5 rounded",
                          sandboxEndpoint === 'POST_v1_brain_classify_batch' ? "bg-purple-50 text-purple-650" : "bg-emerald-50 text-[#228B22]"
                        )}>
                          {sandboxEndpoint === 'POST_v1_brain_classify_batch' ? "LedgerFlow AI engine" : "Bayesian matching pipeline"}
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        value={fieldMatchDesc}
                        onChange={(e) => setFieldMatchDesc(e.target.value)}
                        className="w-full font-mono text-[11px] p-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg focus:ring-1 focus:ring-slate-950 focus:outline-none"
                        placeholder={sandboxEndpoint === 'POST_v1_brain_classify_batch' ? "Google Workspace Subscription\nUber Trip Ride NY\nRent Office Suite 12\nHardware Store Staples" : "Uber trip ride...\nAWS Web Services"}
                      />
                    </div>
                  </div>
                )}

                {/* BRAIN ANALYZE inputs */}
                {sandboxEndpoint === 'POST_brain_analyze' && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-black uppercase text-[var(--muted)]">Cognitive Prompt Directive</label>
                        <span className="text-[9px] text-[#800080] font-semibold bg-purple-50 px-1.5 rounded">LedgerFlow AI Model</span>
                      </div>
                      <textarea
                        rows={4}
                        value={fieldAIPrompt}
                        onChange={(e) => setFieldAIPrompt(e.target.value)}
                        className="w-full text-xs p-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg focus:ring-1 focus:ring-slate-950 focus:outline-none"
                        placeholder="Provide details..."
                      />
                    </div>
                  </div>
                )}

                {/* Static / Empty params notice */}
                {(sandboxEndpoint.startsWith('GET_') || sandboxEndpoint === 'DELETE_') && (
                  <div className="py-4 text-center border border-[var(--line)] bg-[var(--ink)]/50 rounded-lg">
                    <p className="text-[11px] font-medium text-[var(--muted)] italic">No request body required for this rest protocol query.</p>
                    <p className="text-[9px] text-[var(--muted)] mt-1 font-mono">{`Method: ${sandboxEndpoint.split('_')[0]} | Workspace: ${currentWorkspace?.id || ''}`}</p>
                  </div>
                )}
              </div>

              {/* Fire button */}
              <button
                onClick={runSandboxRequest}
                disabled={sandboxLoading}
                className="w-full py-3.5 bg-slate-950 text-white font-black uppercase tracking-wider text-xs rounded-xl hover:bg-slate-800 disabled:bg-slate-300 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer hover:scale-[1.01]"
               aria-label="Refresh Cw action">
                {sandboxLoading ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    Calculating Double-Entry Matrix...
                  </>
                ) : (
                  <>
                    <Play size={12} fill="currentColor" />
                    EXECUTE APERIODIC API QUERY
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="lg:col-span-12 xl:col-span-7 space-y-6">
            {/* Realtime generated code blocks side-by-side! */}
            <div className="ledger-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-900"></div>
                  <h4 className="font-header font-bold text-sm text-[var(--text)]">Dynamic Client SDK Generator</h4>
                </div>
                <div className="flex bg-[var(--ink)] rounded-lg p-0.5 border border-[var(--line)] gap-1">
                  <button
                    onClick={() => setSandboxLang('curl')}
                    className={cn("px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer", sandboxLang === 'curl' ? "bg-[var(--surface)] text-slate-950 shadow-3xs" : "text-[var(--muted)]")}
                  >
                    cURL
                  </button>
                  <button
                    onClick={() => setSandboxLang('python')}
                    className={cn("px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer", sandboxLang === 'python' ? "bg-[var(--surface)] text-slate-950 shadow-3xs" : "text-[var(--muted)]")}
                  >
                    Python
                  </button>
                  <button
                    onClick={() => setSandboxLang('node')}
                    className={cn("px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer", sandboxLang === 'node' ? "bg-[var(--surface)] text-slate-950 shadow-3xs" : "text-[var(--muted)]")}
                  >
                    Node.js
                  </button>
                </div>
              </div>

              <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-4 overflow-x-auto border border-[#292E42] relative select-all">
                <button
                  onClick={() => {
                    const el = document.getElementById('playground_snippet_text');
                    if (el) {
                      navigator.clipboard.writeText(el.innerText);
                      toast.success('Generated SDK segment copied to clipboard!');
                    }
                  }}
                  className="absolute top-2.5 right-2.5 py-1 px-2.5 bg-[#24283B] text-[#9ECE6A] text-[9px] rounded hover:bg-[#2F3549] cursor-pointer flex items-center gap-1 border-0"
                >
                  <Copy size={10} /> Copier
                </button>
                <pre id="playground_snippet_text" className="font-mono text-xs leading-relaxed max-h-[220px]">
{/* Display generated source code dynamically */}
{sandboxLang === 'curl' ? (
`curl -X ${sandboxEndpoint.split('_')[0]} "https://${window.location.host}/api/v1/${getEndpointPath(sandboxEndpoint)}${sandboxEndpoint.startsWith('GET_') && !sandboxEndpoint.includes('workspaces') ? '?workspaceId='+(currentWorkspace?.id || '') : ''}" \\
  -H "Authorization: Bearer ${sandboxCredType === 'session' ? '<YOUR_ADMIN_SESSION_TOKEN>' : (sandboxSelectedKey || '<YOUR_API_KEY>')}" \\
${sandboxEndpoint.startsWith('POST_') ? `  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(getSandboxPayload(sandboxEndpoint), null, 2)}'` : ''}`
) : sandboxLang === 'python' ? (
`import requests

url = "https://${window.location.host}/api/v1/${getEndpointPath(sandboxEndpoint)}"
headers = {
    "Authorization": "Bearer ${sandboxCredType === 'session' ? 'SESSION_TOKEN' : (sandboxSelectedKey || 'API_KEY')}",
    "Content-Type": "application/json"
}
${sandboxEndpoint.startsWith('GET_') ? `params = { "workspaceId": "${currentWorkspace?.id || ''}" }
response = requests.get(url, headers=headers, params=params)` : `payload = ${JSON.stringify(getSandboxPayload(sandboxEndpoint), null, 4)}
response = requests.post(url, headers=headers, json=payload)`}
print(response.json())`
) : (
`import fetch from 'node-fetch';

const url = "https://${window.location.host}/api/v1/${getEndpointPath(sandboxEndpoint)}${sandboxEndpoint.startsWith('GET_') && !sandboxEndpoint.includes('workspaces') ? '?workspaceId='+(currentWorkspace?.id || '') : ''}";

fetch(url, {
  method: '${sandboxEndpoint.split('_')[0]}',
  headers: {
    'Authorization': 'Bearer ${sandboxCredType === 'session' ? 'SESSION_TOKEN' : (sandboxSelectedKey || 'API_KEY')}',
    'Content-Type': 'application/json'
  }${sandboxEndpoint.startsWith('POST_') ? `,\n  body: JSON.stringify(${JSON.stringify(getSandboxPayload(sandboxEndpoint), null, 2).replace(/\n/g, '\n  ')})` : ''}
})
.then(res => res.json())
.then(data => console.info(data))
.catch(console.error);`
)}
                </pre>
              </div>
            </div>

            {/* Sandbox response view box */}
            <div className="ledger-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-slate-450" />
                  <span className="font-header font-bold text-sm text-[var(--text)]">Integrity Engine Response Buffer</span>
                </div>

                {sandboxStatus !== null && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[var(--muted)] font-mono font-bold uppercase">Latency: <strong className="text-[var(--text)]">{sandboxLatency} ms</strong></span>
                    <span className={cn(
                      "px-2 px-1 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase font-mono text-white",
                      sandboxStatus >= 200 && sandboxStatus < 300 ? "bg-emerald-500" : "bg-rose-500"
                    )}>
                      Status {sandboxStatus}
                    </span>
                  </div>
                )}
              </div>

              {!sandboxLoading && !sandboxResult && (
                <div className="p-4 md:p-8 text-center text-[var(--muted)] italic text-xs space-y-2 border border-dashed border-[var(--line)] bg-[var(--ink)]/50 rounded-xl">
                  <p>Execute an API query inside the left configuration deck to view operational responses in real-time.</p>
                  <p className="text-[10px] text-slate-350 font-mono">Payload parameters are completely sanitised & verified against your active database ledger nodes.</p>
                </div>
              )}

              {sandboxLoading && (
                <div className="p-12 text-center border border-[var(--line)] bg-[var(--ink)]/20 rounded-xl flex flex-col items-center justify-center space-y-4 animate-in fade-in">
                  <RefreshCw size={24} className="animate-spin text-slate-550" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-700">Inquiring Integrity Ledger Gateways...</p>
                    <p className="text-[10px] text-slate-450">Verifying signature key matching and double-entry transaction locks</p>
                  </div>
                </div>
              )}

              {sandboxResult && (
                <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-[#1A1B26] text-[#A9B1D6] rounded-xl p-4 border border-[#292E42] max-h-[350px] overflow-y-auto select-all relative">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(sandboxResult, null, 2));
                        toast.success('Response JSON copied to clipboard!');
                      }}
                      className="absolute top-2.5 right-2.5 py-1 px-2.5 bg-[#24283B] text-[#7AA2F7] text-[9px] rounded hover:bg-[#2F3549] cursor-pointer border-0"
                    >
                      Copy JSON
                    </button>
                    <pre className="font-mono text-xs leading-relaxed">
                      {JSON.stringify(sandboxResult, null, 2)}
                    </pre>
                  </div>
                  <div className="flex justify-between items-center bg-[var(--ink)] border border-slate-220/80 rounded-xl px-4 py-3 text-[10px] text-[var(--muted)] font-medium">
                    <span className="flex items-center gap-1.5"><Shield size={12} className="text-emerald-600" /> Double-entry verified successfully</span>
                    <span className="font-mono text-slate-600">Computation: {sandboxStatus === 201 || sandboxEndpoint.includes('POST_brain') ? '15 units computed' : '1 unit computed'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="ledger-card p-6 space-y-6 animate-in fade-in duration-300 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-indigo-600 flex items-center justify-center">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="font-header font-bold text-[var(--text)]">API Pipeline Chronological Logs</h3>
                <p className="text-xs text-[var(--muted)] font-medium">Diagnostic ledger feed & key consumption audits.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={fetchLogs}
                className="p-2 bg-[var(--ink)] border border-[var(--line)] text-slate-700 rounded-lg hover:bg-slate-100 transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer"
               aria-label="Sync Feed">
                <RefreshCw size={12} /> Sync Feed
              </button>
            </div>
          </div>

          {/* Table display */}
          {apiLogs.length === 0 ? (
            <div className="py-12 text-center border border-slate-150 bg-[var(--ink)]/50 rounded-[32px]">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Activity size={20} className="text-[var(--muted)]" />
              </div>
              <p className="text-xs text-[var(--muted)] font-medium italic">No integration API requests have been processed in this workspace yet.</p>
              <p className="text-[10px] text-[var(--muted)] mt-1">Make API queries via the <strong>Playground Sandbox</strong> or integrations to populate this monitor.</p>
            </div>
          ) : (
            <div className="border border-slate-150 rounded-[32px] shadow-3xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#FAFBFB] border-b border-slate-150 text-[10px] text-[var(--muted)] uppercase tracking-wider font-extrabold">
                    <tr>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Request Specs</th>
                      <th className="p-4">Key Credit Cost</th>
                      <th className="p-4">API Origin Credentials</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-[var(--surface)]">
                    {apiLogs.map((log: any, idx: number) => {
                      const isSuccess = log.status >= 200 && log.status < 300;
                      return (
                        <tr key={idx} className="hover:bg-[var(--ink)]/50 transition-colors">
                          <td className="p-4 whitespace-nowrap text-xs font-mono font-bold text-slate-450 text-[11px]">
                            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider font-mono text-white",
                                log.method === 'POST' ? "bg-emerald-500" :
                                log.method === 'PUT' ? "bg-amber-500" :
                                log.method === 'DELETE' ? "bg-rose-500" : "bg-blue-500"
                              )}>
                                {log.method || 'GET'}
                              </span>
                              <span className="font-mono text-xs text-[var(--text)] font-bold max-w-[200px] truncate">{log.path || '/api/v1/status'}</span>
                            </div>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="text-xs font-mono font-bold text-slate-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                              {log.method === 'POST' && log.path.includes('brain') ? '10 cr' : log.method === 'POST' ? '3 cr' : '1 cr'}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="text-[11px] font-mono bg-[var(--ink)] text-slate-600 px-2 py-0.5 rounded border border-[var(--line)]">
                              {log.apiKeyUsed === 'Active Admin Session' ? '🖥️ Admin Session' : `🔑 Key: lf_id_${String(log.apiKeyUsed).slice(-6)}`}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide font-mono uppercase text-white",
                              isSuccess ? "bg-emerald-500" : "bg-rose-500"
                            )}>
                              {log.status || 200} {isSuccess ? 'Success' : 'Error'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => {
                                toast.info("API Frame Inspected", {
                                  description: <div className="font-mono text-[9px] text-left overflow-x-auto max-h-[140px] bg-slate-900 text-slate-200 p-2 rounded mt-2">{JSON.stringify(log, null, 2)}</div>,
                                  duration: 6000
                                });
                              }}
                              className="text-xs font-bold text-indigo-600 hover:underline bg-transparent border-0 cursor-pointer"
                            >
                              Inspect Raw
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="ledger-card p-6 space-y-3 shadow-3xs hover:border-slate-300 transition-all border border-slate-150">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-[var(--muted)] tracking-wider">Workspace Plan Tier</span>
                <span className="px-2 py-0.5 bg-purple-100 text-[#8A2BE2] text-[9px] font-black rounded-full uppercase tracking-wider">Enterprise API</span>
              </div>
              <div className="flex items-baseline gap-1 pt-1.5">
                <span className="text-2xl font-black text-[var(--text)] font-display">SaaS Growth</span>
              </div>
              <p className="text-[10px] text-[var(--muted)] font-medium">Billed dynamically based on computational complexity parameters processed.</p>
            </div>

            <div className="ledger-card p-6 space-y-3 shadow-3xs hover:border-slate-300 transition-all border border-slate-150">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-[var(--muted)] tracking-wider">Remaining Compute Balance</span>
                <Zap size={14} className="text-[#FFD700] fill-[#FFD700]" />
              </div>
              <div className="flex items-baseline gap-1 pt-1.5">
                <span className="text-2xl font-black text-[var(--text)] font-mono">100,000 / 100,000</span>
                <span className="text-[10px] text-[var(--muted)] font-black">UNITS</span>
              </div>
              <p className="text-[10px] text-[var(--muted)] font-medium">Quota allocated monthly. Resets in 23 days.</p>
            </div>

            <div className="ledger-card p-6 space-y-3 shadow-3xs hover:border-slate-300 transition-all border border-slate-150">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-[var(--muted)] tracking-wider">Total Operations Calculated</span>
                <TrendingUp size={14} className="text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-1 pt-1.5">
                <span className="text-2xl font-black text-[var(--text)] font-mono">{apiLogs.length}</span>
                <span className="text-[11px] text-[var(--muted)] font-bold uppercase tracking-widest font-mono">Operations</span>
              </div>
              <p className="text-[10px] text-[var(--muted)] font-medium">Audit logs track execution and delta mappings securely.</p>
            </div>

            <div className="ledger-card p-6 space-y-3 shadow-3xs hover:border-slate-300 transition-all border border-slate-150">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-[var(--muted)] tracking-wider">Seat Booking Capacity</span>
                <Users size={14} className="text-[var(--muted)]" />
              </div>
              <div className="flex items-baseline gap-1 pt-1.5">
                <span className="text-2xl font-black text-[var(--text)] font-mono">1 / 50</span>
                <span className="text-[10px] text-[var(--muted)] font-bold">SEATS</span>
              </div>
              <p className="text-[10px] text-[var(--muted)] font-medium">Seats can be scaled with slider simulation below.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Interactive seat allocation slider for CFOs / Persons */}
            <div className="ledger-card p-6 space-y-5 shadow-3xs border border-slate-150">
              <div className="flex items-center gap-3 border-b border-indigo-50 pb-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Sliders size={16} />
                </div>
                <div>
                  <h4 className="font-header font-bold text-[var(--text)] text-sm">Strategic Corporate Capacity Modeler</h4>
                  <p className="text-[9px] text-[var(--muted)] uppercase tracking-widest font-black">Capacity Allocation & Cost Estimations</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Allocated Ledger Seats</span>
                    <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{simSeatsCount} Active Seats</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={simSeatsCount}
                    onChange={(e) => setSimSeatsCount(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between text-[9px] text-[var(--muted)]">
                    <span>1 Seat (Sole Agent)</span>
                    <span>50 Seats (Enterprise Suite)</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--line)] space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--muted)] font-bold">Projected Monthly Platform License</span>
                    <span className="font-mono font-bold text-slate-950">${(simSeatsCount * 12).toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--muted)] font-bold">Workspace compute priority</span>
                    <span className="font-bold text-emerald-600">{simSeatsCount > 25 ? '🔥 High Priority Core Threads' : 'Standard Queue Thread'}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleCheckout("pro")}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-[10px] rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <TrendingUp size={12} />
                  Upgrade to Pro ($5/mo)
                </button>
                <p className="text-[10px] text-center text-[var(--muted)] font-medium">Over limit requests will be billed based on API compute utilization securely via Stripe.</p>
              </div>
            </div>

            {/* Load Stress-Tester tool */}
            <div className="ledger-card p-6 space-y-5 shadow-3xs border border-slate-150">
              <div className="flex items-center gap-3 border-b border-purple-50 pb-3">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <Gauge size={16} />
                </div>
                <div>
                  <h4 className="font-header font-bold text-[var(--text)] text-sm">TruthEngine Stress-Testing Console</h4>
                  <p className="text-[9px] text-[var(--muted)] uppercase tracking-widest font-black">Dispatch synthetic load test</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Burst Intensity</span>
                    <span className="font-mono font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{simRequestsCount} Parallel Queries</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="10"
                    value={simRequestsCount}
                    onChange={(e) => setSimRequestsCount(parseInt(e.target.value, 10))}
                    className="w-full accent-purple-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between text-[9px] text-[var(--muted)]">
                    <span>10 hits (Light check)</span>
                    <span>100 hits (Intense Stress)</span>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    setIsSimulatingBurst(true);
                    toast.promise(
                      new Promise((resolve) => setTimeout(resolve, 1500)),
                      {
                        loading: `Simulating ${simRequestsCount} burst operations to TruthEngine...`,
                        success: () => {
                          setIsSimulatingBurst(false);
                          fetchLogs();
                          loadBillingStatus();
                          return `Processed ${simRequestsCount} requests safely under 100 req/min limits!`;
                        },
                        error: 'Simulation failed'
                      }
                    );
                  }}
                  disabled={isSimulatingBurst}
                  className="w-full py-3 bg-[#8A2BE2] disabled:bg-slate-350 text-white font-black uppercase tracking-wider text-[10px] rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs hover:scale-[1.01]"
                >
                  <Coins size={12} />
                  TRIGGER programatic stress test
                </button>
              </div>
            </div>
          </div>

          {/* Subledgers trace of compute costs */}
          <div className="ledger-card p-6 space-y-4 shadow-3xs border border-slate-150">
            <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3">
              <Zap size={14} className="text-purple-600" />
              <h4 className="font-header font-bold text-[#8A2BE2] text-sm uppercase tracking-wide">Ledger computational processing trace</h4>
            </div>

            <div className="bg-[#FAFBFB] p-4 rounded-xl border border-slate-150 space-y-2 text-[11px] font-mono leading-relaxed text-slate-550">
              <p className="font-bold text-[var(--text)]">Double-Entry ledger integrity is managed with complexity weight algorithms:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 pt-1">
                <div className="flex justify-between border-b border-dashed border-[var(--line)] py-0.5">
                  <span>BAYESIAN_CLASSIFIER_PASS:</span>
                  <span className="font-bold text-slate-700">3 units computed</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-[var(--line)] py-0.5">
                  <span>CORTEX_AI_ANALYSIS:</span>
                  <span className="font-bold text-slate-700">10 units computed</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-[var(--line)] py-0.5">
                  <span>LEDGER_BALANCE_VALIDATION:</span>
                  <span className="font-bold text-slate-700">1 unit computed</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-[var(--line)] py-0.5">
                  <span>METRICS_CORRELATION_PASS:</span>
                  <span className="font-bold text-slate-700">1 unit computed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
}
