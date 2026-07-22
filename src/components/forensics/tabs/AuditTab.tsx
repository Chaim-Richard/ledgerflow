import React from 'react';
import { motion } from 'motion/react';
import { Activity, RefreshCw, Database, CheckCircle2, AlertTriangle, Lock, AlertCircle, Wand2 } from 'lucide-react';
import { Transaction, ChartAccount, JournalEntry } from '../../../types';
import { cn, formatCurrency } from '../../../lib/utils';
import { AuditResult } from '../../../services/auditor';

interface AuditTabProps {
  transactions: Transaction[];
  accounts: ChartAccount[];
  journalEntries: JournalEntry[];
  runDiagnostics: () => Promise<void>;
  isVerifying: boolean;
  results: AuditResult | null;
  handleRepairChain: () => Promise<void>;
  isRepairing: boolean;
  handleFixImbalances: () => void;
}

export default function AuditTab({
  transactions,
  accounts,
  journalEntries,
  runDiagnostics,
  isVerifying,
  results,
  handleRepairChain,
  isRepairing,
  handleFixImbalances,
}: AuditTabProps) {
  return (
    <motion.div
      key="audit-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-10"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[var(--line)] pb-6 gap-4 animate-fade-in text-left">
        <div>
          <h4 className="text-xl font-black text-[var(--text)] uppercase tracking-tight">Master Cryptographic Diagnostic Scans</h4>
          <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-wider mt-1 opacity-65">Sequential hashing integrity checks across Merkle roots</p>
        </div>
        <button 
          onClick={runDiagnostics}
          disabled={isVerifying}
          className="h-14 px-10 bg-[var(--ink)] text-[var(--panel)] rounded-xl flex items-center gap-4 font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all group/btn disabled:opacity-50"
        >
          {isVerifying ? <RefreshCw className="animate-spin" size={16} /> : <Activity size={16} />}
          {isVerifying ? 'Hashing ledger values...' : 'Run master verification'}
        </button>
      </div>

      {!results && !isVerifying && (
        <div className="py-24 text-center space-y-6 animate-fade-in">
          <div className="w-24 h-24 bg-[var(--ink)] rounded-xl flex items-center justify-center mx-auto text-[var(--muted)] border-2 border-dashed border-[var(--line)] shadow-sm">
            <Database size={36} />
          </div>
          <div>
            <p className="text-sm text-[var(--text)] font-black uppercase tracking-[0.3em] max-w-xs mx-auto">
              Verifier Offline
            </p>
            <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] opacity-40 mt-1">
              Run master verification to construct current cryptographic Merkle Tree
            </p>
          </div>
        </div>
      )}

      {isVerifying && (
        <div className="py-24 text-center space-y-6">
          <div className="flex justify-center gap-3 animate-fade-in">
            {[0, 1, 2].map(i => (
              <motion.div 
                key={i}
                animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                className="w-4 h-4 bg-emerald-500 rounded-full"
              />
            ))}
          </div>
          <p className="text-xs font-bold text-[var(--text)] uppercase tracking-[0.3em] animate-pulse">Scanning bi-lateral ledger hashes...</p>
        </div>
      )}

      {results && (
        <div className="space-y-10 animate-fade-in text-left">
          {/* Diagnostic Balances Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 md:p-8 bg-[var(--ink)]/20 rounded-xl border border-[var(--line)] flex flex-col justify-between group hover:bg-[var(--surface)] transition-all shadow-sm">
              <span className="text-[9px] font-black text-[var(--muted)] uppercase tracking-[0.3em]">Cumulative Debit Values</span>
              <p className="text-3xl font-black text-[var(--text)] tracking-tight mt-3">{formatCurrency(results.totalDebits)}</p>
              <p className="text-[10px] text-emerald-600 font-bold mt-2 uppercase tracking-wide">Matches double-entry target entries</p>
            </div>

            <div className="p-4 md:p-8 bg-[var(--ink)]/20 rounded-xl border border-[var(--line)] flex flex-col justify-between group hover:bg-[var(--surface)] transition-all shadow-sm">
              <span className="text-[9px] font-black text-[var(--muted)] uppercase tracking-[0.3em]">Cumulative Credit Values</span>
              <p className="text-3xl font-black text-[var(--text)] tracking-tight mt-3">{formatCurrency(results.totalCredits)}</p>
              <p className="text-[10px] text-emerald-600 font-bold mt-2 uppercase tracking-wide">Reflects full account double-entry mappings</p>
            </div>

            <div className={cn(
              "p-8 rounded-xl border flex flex-col justify-between shadow-xl transition-all",
              results.isBalanced ? "bg-emerald-600 text-[var(--panel)] border-emerald-500" : "bg-rose-600 text-[var(--panel)] border-rose-500"
            )}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-80">Arithmetic Balancing Delta</span>
                {results.isBalanced ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              </div>
              <p className="text-3xl font-black font-mono tracking-tight mt-3">
                {formatCurrency(results.totalDebits - results.totalCredits)}
              </p>
              <p className="text-[10px] font-bold mt-2 uppercase tracking-wide opacity-80">
                {results.isBalanced ? "Mathematical Symmetry Intact (0.00)" : "Imbalanced ledger entry detected"}
              </p>
            </div>
          </div>

          {/* Cryptographic Secure Merkle Proof */}
          <div className="p-4 md:p-6 lg:p-8 bg-[var(--ink)] text-[var(--panel)] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl border border-slate-800">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-[var(--surface)]/10 rounded-xl flex items-center justify-center text-emerald-400">
                <Lock size={20} />
              </div>
              <div>
                <p className="text-[9px] font-black text-[var(--panel)]/40 uppercase tracking-widest truncate leading-none mb-2">Cryptographic Source of Integrity (Merkle root)</p>
                <p className="text-xs font-mono text-emerald-300 break-all uppercase tracking-tight">{results.merkleRoot}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 self-start md:self-center">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] font-mono">Immutable</span>
            </div>
          </div>

          {/* Operational Check Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 bg-[var(--panel)] rounded-2xl border border-[var(--line)] space-y-4 shadow-sm hover:border-slate-800/20 transition-all">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                <span className="text-md font-black text-[var(--text)] uppercase tracking-tight">Zero-Leaking Bookkeeping</span>
                {results.isBalanced ? <CheckCircle2 className="text-emerald-500" size={18} /> : <AlertCircle className="text-rose-500" size={18} />}
              </div>
              <p className="text-xs text-[var(--muted)] font-medium">Checks if bi-lateral ledger offsets net zero. Solitary entries without corresponding balancing sides are strictly highlighted.</p>
              {!results.isBalanced && (
                <button 
                  onClick={handleFixImbalances}
                  className="w-full h-11 bg-rose-600 text-[var(--panel)] rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                >
                  <Wand2 size={12} /> Balance Ledger Cents
                </button>
              )}
            </div>

            <div className="p-6 bg-[var(--panel)] rounded-2xl border border-[var(--line)] space-y-4 shadow-sm hover:border-slate-800/20 transition-all">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                <span className="text-md font-black text-[var(--text)] uppercase tracking-tight">Hash Sequence Custody</span>
                {results.hashChainValid ? <Lock className="text-emerald-500" size={16} /> : <AlertTriangle className="text-rose-500" size={16} />}
              </div>
              <p className="text-xs text-[var(--muted)] font-medium">Verify blockchain-style sequential tracking of prior financial states preventing backdated account changes.</p>
              {!results.hashChainValid && (
                <button 
                  onClick={handleRepairChain}
                  disabled={isRepairing}
                  className="w-full h-11 bg-rose-600 text-[var(--panel)] rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className={cn("size-3", isRepairing && "animate-spin")} />
                  Re-serialize Timeline Hash Chain
                </button>
              )}
            </div>
          </div>

          {/* Custom Logs */}
          <div className="space-y-4">
            <h5 className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest truncate">Audit stream validation report logs</h5>
            <div className="max-h-64 overflow-y-auto bg-[var(--ink)] rounded-xl p-6 text-[11px] font-mono text-slate-300 leading-relaxed space-y-2 relative border border-slate-800">
              {results.imbalances.length === 0 && results.orphans.length === 0 && results.missingAccounts.length === 0 && (
                <div className="text-emerald-400 font-bold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  [VALID] DOUBLE-ENTRY MATRICES ZERO ACCURACY DELTA SECURED.
                </div>
              )}
              {results.imbalances.slice(0, 100).map((im, idx) => (
                <div key={idx} className="text-rose-400">
                  [ERROR] Imbalance in {im.type === 'journal' ? 'Journal' : 'Transaction'} Split {im.id.substring(0,8)}: Math difference of {formatCurrency(im.diff)}
                </div>
              ))}
              {results.orphans.slice(0, 100).map((or, idx) => (
                <div key={idx} className="text-amber-400">
                  [WARN] Detached Allocations Core pointer detected in {or.id.substring(0,8)}: {or.message}
                </div>
              ))}
              {results.missingAccounts.slice(0, 100).map((ma, idx) => (
                <div key={idx} className="text-rose-500 font-bold">
                  [CRITICAL] Account code resolution failure: Code "{ma.accountName}" used on transaction {ma.id.substring(0, 8)} is unregistered in Chart registers.
                </div>
              ))}
              {results.duplicateCandidates.slice(0, 100).map((dc, idx) => (
                <div key={idx} className="text-[var(--muted)] font-medium">
                  [SCAN] Similarity anomaly detected inside Transaction {dc.id.substring(0,8)}: {dc.reason}
                </div>
              ))}
              {(results.imbalances.length > 100 || results.duplicateCandidates.length > 100) && (
                <div className="text-[var(--muted)] italic pt-2">
                  [LOG TRUNCATED] Showing maximum of 100 entries per category to preserve rendering performance on massive ledgers.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
