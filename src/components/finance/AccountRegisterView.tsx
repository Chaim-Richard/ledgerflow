import React, { useState, useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { Transaction } from '../../types';
import { isPostable, lineAmount } from '../../lib/txFilters';
import { formatDecimal, formatCurrency, cn } from '../../lib/utils';
import { calculateAccountRegisterBalances, visibleAccountRegisterEntries } from '../../lib/accountRegister';
import { BookOpen, Search, CheckCircle2, Circle, Filter, Building2 } from 'lucide-react';

export const AccountRegisterView: React.FC = () => {
  const accounts = useLedgerStore(s => s.accounts);
  const transactions = useLedgerStore(s => s.transactions);
  const updateTransaction = useLedgerStore(s => s.updateTransaction);

  // Default to first cash or asset account
  const defaultAccount = useMemo(() => {
    return accounts.find(a => a.type === 'asset') || accounts[0] || null;
  }, [accounts]);

  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => defaultAccount?.id || '');
  const [unclearedOnly, setUnclearedOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === selectedAccountId) || defaultAccount;
  }, [accounts, selectedAccountId, defaultAccount]);

  // Extract all lines for this account across postable transactions, sorted newest first
  const { entries, registerCalculation } = useMemo(() => {
    if (!selectedAccount) {
      return { entries: [], registerCalculation: { endingBalanceMinor: 0, runningNewestFirst: [] } };
    }

    const isDebitNature = ['asset', 'expense', 'cost_of_goods'].includes(selectedAccount.type);
    const openingBalance = selectedAccount.openingBalanceCents || 0;

    const rawEntries: Array<{
      id: string;
      txId: string;
      date: string;
      reference?: string;
      payee?: string;
      description: string;
      accountId: string;
      deltaMinor: number;
      debitMinor: number;
      creditMinor: number;
      isCleared: boolean;
      originalTx: Transaction;
    }> = [];

    let totalActivityMinor = 0;

    // Filter postable transactions
    const postableTxs = transactions.filter(isPostable);

    // Collect all lines for this account
    postableTxs.forEach(tx => {
      tx.lines?.forEach((line, lineIdx) => {
        if (line.accountId === selectedAccount.id) {
          const amt = lineAmount(line, tx);
          // For debit-nature accounts: positive amount is debit (+), negative is credit (-)
          // The delta to the balance:
          const delta = isDebitNature ? amt : -amt;
          totalActivityMinor += delta;

          rawEntries.push({
            id: `${tx.id}-${lineIdx}`,
            txId: tx.id,
            date: tx.date,
            reference: (tx as typeof tx & { reference?: string; checkNumber?: string; entity?: string; isReconciled?: boolean }).reference || (tx as typeof tx & { reference?: string; checkNumber?: string; entity?: string; isReconciled?: boolean }).checkNumber || '',
            payee: (tx as typeof tx & { reference?: string; checkNumber?: string; entity?: string; isReconciled?: boolean }).payee || (tx as typeof tx & { reference?: string; checkNumber?: string; entity?: string; isReconciled?: boolean }).entity || '',
            description: line.description || tx.description || 'Transaction',
            accountId: line.accountId,
            deltaMinor: delta,
            debitMinor: amt > 0 ? amt : 0,
            creditMinor: amt < 0 ? Math.abs(amt) : 0,
            isCleared: (line as typeof line & { isCleared?: boolean }).isCleared === true || (tx as typeof tx & { reference?: string; checkNumber?: string; entity?: string; isReconciled?: boolean }).isReconciled === true,
            originalTx: tx
          });
        }
      });
    });

    // Sort newest first
    rawEntries.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return b.txId.localeCompare(a.txId);
    });

    // Guard integer values for calculation
    const safeStart = Number.isSafeInteger(openingBalance) ? openingBalance : 0;
    const safeActivity = Number.isSafeInteger(totalActivityMinor) ? totalActivityMinor : 0;
    const newestAmounts = rawEntries.map(e => Number.isSafeInteger(e.deltaMinor) ? e.deltaMinor : 0);

    const calc = calculateAccountRegisterBalances(safeStart, safeActivity, newestAmounts);

    return {
      entries: rawEntries,
      registerCalculation: calc
    };
  }, [selectedAccount, transactions]);

  // Filter entries based on search and uncleared filter
  const displayedEntries = useMemo(() => {
    let list = entries.map((entry, idx) => ({
      ...entry,
      runningBalanceMinor: registerCalculation.runningNewestFirst[idx] ?? 0
    }));

    if (unclearedOnly) {
      list = visibleAccountRegisterEntries(list, true);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(e => 
        e.description.toLowerCase().includes(q) ||
        (e.reference && e.reference.toLowerCase().includes(q)) ||
        (e.payee && e.payee.toLowerCase().includes(q))
      );
    }

    return list;
  }, [entries, registerCalculation, unclearedOnly, searchQuery]);

  const handleToggleCleared = (txId: string, currentCleared: boolean) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;
    updateTransaction(txId, {
      ...tx,
      isReconciled: !currentCleared
    } as unknown as Partial<Transaction>);
  };

  return (
    <div id="account-register-view" className="flex flex-col h-full bg-[var(--surface)] text-[var(--text)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-[var(--surface-sunken)]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--accent)]/10 text-[var(--accent)] rounded-lg">
            <BookOpen aria-hidden="true" className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Account Register</h1>
            <p className="text-xs text-[var(--text-muted)]">Checkbook-style running ledger with transactional clearance</p>
          </div>
        </div>

        {/* Account Selector & Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 aria-hidden="true" className="w-4 h-4 text-[var(--text-muted)]" />
            <select aria-label="Register account"
              id="select-register-account"
              value={selectedAccount?.id || ''}
              onChange={e => setSelectedAccountId(e.target.value)}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.code ? `${acc.code} — ` : ''}{acc.name} ({acc.type})
                </option>
              ))}
            </select>
          </div>

          <button
            id="btn-register-uncleared-toggle"
            onClick={() => setUnclearedOnly(prev => !prev)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 border transition",
              unclearedOnly 
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30" 
                : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)]"
            )}
          >
            <Filter aria-hidden="true" className="w-3.5 h-3.5" />
            <span>{unclearedOnly ? "Uncleared Only" : "All Entries"}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)] font-medium">Opening Balance</span>
          <p className="text-base font-semibold mt-0.5 tabular-nums">
            {formatCurrency(selectedAccount?.openingBalanceCents || 0)}
          </p>
        </div>
        <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)] font-medium">Period Activity</span>
          <p className={cn(
            "text-base font-semibold mt-0.5",
            (registerCalculation.endingBalanceMinor - (selectedAccount?.openingBalanceCents || 0)) >= 0 ? "text-emerald-400" : "text-rose-400"
          )}>
            {formatCurrency(registerCalculation.endingBalanceMinor - (selectedAccount?.openingBalanceCents || 0))}
          </p>
        </div>
        <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)] font-medium">Current Register Balance</span>
          <p className="text-base font-bold text-[var(--accent)] mt-0.5 tabular-nums">
            {formatCurrency(registerCalculation.endingBalanceMinor)}
          </p>
        </div>
        <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)] font-medium">Total Registered Rows</span>
          <p className="text-base font-semibold mt-0.5">
            {displayedEntries.length} rows
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="px-4 py-2 border-b border-[var(--border)] flex items-center gap-2 bg-[var(--surface-sunken)]">
        <Search aria-hidden="true" className="w-4 h-4 text-[var(--text-muted)]" />
        <input aria-label="Filter register by payee, reference, or description"
          id="input-register-search"
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Filter register by payee, reference, or description..."
          className="bg-transparent border-none text-sm w-full focus:outline-none placeholder:text-[var(--text-muted)]"
        />
      </div>

      {/* Checkbook Register Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead className="sticky top-0 bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider font-semibold text-[11px] z-10">
            <tr>
              <th className="py-2.5 px-3 w-10 text-center">Clr</th>
              <th className="py-2.5 px-3 w-28">Date</th>
              <th className="py-2.5 px-3 w-24">Ref / Chk</th>
              <th className="py-2.5 px-3 w-40">Payee</th>
              <th className="py-2.5 px-3">Description / Memo</th>
              <th className="py-2.5 px-3 text-right w-28">Increase (Dr)</th>
              <th className="py-2.5 px-3 text-right w-28">Decrease (Cr)</th>
              <th className="py-2.5 px-3 text-right w-32">Running Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {displayedEntries.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                  No register entries found for this account.
                </td>
              </tr>
            ) : (
              displayedEntries.map(entry => (
                <tr 
                  key={entry.id}
                  className={cn(
                    "hover:bg-[var(--surface-sunken)]/60 transition-colors",
                    entry.isCleared && "bg-emerald-500/[0.02]"
                  )}
                >
                  <td className="py-2.5 px-3 text-center">
                    <button aria-label={entry.isCleared ? "Mark transaction as uncleared" : "Mark transaction as cleared"}
                      onClick={() => handleToggleCleared(entry.txId, entry.isCleared)}
                      title={entry.isCleared ? "Cleared (Click to unmark)" : "Uncleared (Click to clear)"}
                      className="text-[var(--text-muted)] hover:text-emerald-400 transition"
                    >
                      {entry.isCleared ? (
                        <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle aria-hidden="true" className="w-4 h-4 opacity-40 hover:opacity-100" />
                      )}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs">{entry.date}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-[var(--text-muted)] truncate max-w-[96px]">
                    {entry.reference || '—'}
                  </td>
                  <td className="py-2.5 px-3 truncate max-w-[160px] font-medium">
                    {entry.payee || '—'}
                  </td>
                  <td className="py-2.5 px-3 truncate max-w-[280px] text-[var(--text-muted)]">
                    {entry.description}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-medium tabular-nums">
                    {entry.debitMinor > 0 ? formatDecimal(entry.debitMinor) : ''}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-400 font-medium tabular-nums">
                    {entry.creditMinor > 0 ? formatDecimal(entry.creditMinor) : ''}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                    {formatDecimal(entry.runningBalanceMinor)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccountRegisterView;
