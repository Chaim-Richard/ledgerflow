import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../../hooks/useDialog';
import { getIdToken } from '../../firebase';
import { depreciationThrough } from '../../lib/depreciationEngine';
import { disposalGainLoss } from '../../lib/assetDisposal';
import { isCashAccount } from '../../lib/txFilters';
import { formatCurrency, parseAmountToCents } from '../../lib/utils';
import type { ChartAccount, FixedAsset } from '../../types';

/**
 * Sell or scrap a fixed asset (X-03): the date, what was received (nothing when scrapped), where the
 * money went and the account for the gain or loss. Shows the book value on that date (with the
 * depreciation still due through that month) and the gain or loss before anything is posted; the
 * server posts the one entry and marks the asset disposed.
 */
interface Props {
  asset: FixedAsset;
  accounts: ChartAccount[];
  workspaceId: string;
  today: string;
  currency: string;
  onClose: () => void;
}

const field = 'w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] text-sm text-[var(--text)]';
const label = (a: ChartAccount) => `${a.code ? `${a.code} · ` : ''}${a.name}`;

export default function DisposeAssetDialog({ asset, accounts, workspaceId, today, currency, onClose }: Props) {
  const { dialogProps, titleId } = useDialog(onClose, true);
  const active = useMemo(() => accounts.filter(a => !a.isArchived), [accounts]);
  const assetSide = active.filter(a => String(a.type).toLowerCase() === 'asset');
  const moneyAccounts = [...assetSide].sort((a, b) => Number(isCashAccount(b)) - Number(isCashAccount(a)) || a.code.localeCompare(b.code));
  const gainLossAccounts = active.filter(a => ['expense', 'income', 'revenue', 'other_income', 'other_expense'].includes(String(a.type).toLowerCase()));
  const suggested = gainLossAccounts.find(a => /dispos|gain|loss/i.test(a.name));
  const [date, setDate] = useState(today);
  const [received, setReceived] = useState('0');
  const [proceedsAccountId, setProceedsAccountId] = useState(moneyAccounts.find(isCashAccount)?.id || '');
  const [gainLossAccountId, setGainLossAccountId] = useState(suggested?.id || '');
  const [assetAccountId, setAssetAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  const proceedsCents = parseAmountToCents(received) || 0;
  const posted = asset.accumulatedDepreciationCents || 0;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const depreciation = validDate ? Math.max(posted, depreciationThrough(asset, date.slice(0, 7))) : posted;
  const book = (asset.purchasePriceCents || 0) - depreciation;
  const gainLoss = disposalGainLoss({ costCents: asset.purchasePriceCents || 0, postedDepreciationCents: posted, catchUpCents: depreciation - posted, proceedsCents });

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/assets/${encodeURIComponent(asset.id)}/disposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getIdToken()}` },
        body: JSON.stringify({
          date, proceedsCents,
          ...(proceedsCents > 0 && proceedsAccountId ? { proceedsAccountId } : {}),
          ...(gainLossAccountId ? { gainLossAccountId } : {}),
          ...(!asset.assetAccountId && assetAccountId ? { assetAccountId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'The asset could not be disposed of');
      toast.success(`${asset.name} ${proceedsCents > 0 ? 'sold' : 'scrapped'}${data.gainLossCents ? `: ${data.gainLossCents > 0 ? 'gain' : 'loss'} of ${formatCurrency(Math.abs(data.gainLossCents), currency)}` : ''}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div {...dialogProps} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--surface)] rounded-xl shadow-xl max-w-md w-full border border-[var(--line)]">
        <div className="flex items-center justify-between p-5 border-b border-[var(--line)]">
          <h2 id={titleId} className="text-lg font-bold text-[var(--text)]">Sell or scrap {asset.name}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--text)]">
            <X aria-hidden="true" className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="dispose-date" className="block font-semibold text-[var(--text)] mb-1">Date sold or scrapped</label>
              <input id="dispose-date" type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className={field} />
            </div>
            <div>
              <label htmlFor="dispose-received" className="block font-semibold text-[var(--text)] mb-1">Amount received (0 if scrapped)</label>
              <input id="dispose-received" inputMode="decimal" value={received} onChange={e => setReceived(e.target.value)} className={`${field} font-mono`} />
            </div>
          </div>
          {proceedsCents > 0 && (
            <div>
              <label htmlFor="dispose-proceeds" className="block font-semibold text-[var(--text)] mb-1">The money went to</label>
              <select id="dispose-proceeds" value={proceedsAccountId} onChange={e => setProceedsAccountId(e.target.value)} className={field}>
                <option value="">Choose…</option>
                {moneyAccounts.map(a => <option key={a.id} value={a.id}>{label(a)}</option>)}
              </select>
            </div>
          )}
          {!asset.assetAccountId && (
            <div>
              <label htmlFor="dispose-asset-account" className="block font-semibold text-[var(--text)] mb-1">Account the asset is in</label>
              <select id="dispose-asset-account" value={assetAccountId} onChange={e => setAssetAccountId(e.target.value)} className={field}>
                <option value="">Choose…</option>
                {assetSide.map(a => <option key={a.id} value={a.id}>{label(a)}</option>)}
              </select>
            </div>
          )}
          {gainLoss !== 0 && (
            <div>
              <label htmlFor="dispose-gain-loss" className="block font-semibold text-[var(--text)] mb-1">Account for the {gainLoss > 0 ? 'gain' : 'loss'}</label>
              <select id="dispose-gain-loss" value={gainLossAccountId} onChange={e => setGainLossAccountId(e.target.value)} className={field}>
                <option value="">Choose…</option>
                {gainLossAccounts.map(a => <option key={a.id} value={a.id}>{label(a)}</option>)}
              </select>
            </div>
          )}
          <p role="status" className="text-[var(--text)] bg-[var(--ink)] border border-[var(--line)] rounded-lg p-3">
            Book value on that date: {formatCurrency(book, currency)} (cost {formatCurrency(asset.purchasePriceCents || 0, currency)}, depreciation {formatCurrency(depreciation, currency)}
            {depreciation > posted ? `, of which ${formatCurrency(depreciation - posted, currency)} is posted now` : ''}).{' '}
            {gainLoss === 0 ? 'No gain or loss.' : `${gainLoss > 0 ? 'Gain' : 'Loss'} on disposal: ${formatCurrency(Math.abs(gainLoss), currency)}.`}
          </p>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-[var(--text)] hover:bg-[var(--ink)]">Cancel</button>
            <button type="button" disabled={saving || !validDate} onClick={submit} className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-700 text-white disabled:opacity-50">
              {saving ? 'Posting…' : proceedsCents > 0 ? 'Record the sale' : 'Record as scrapped'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
