import { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { seedCountryDemoWorkspace, type DemoCountry } from '../../lib/countryDemoWorkspace';

/** Country samples are intentionally client-only and available only before sign-in. */
export default function GuestCountrySamplePicker() {
  const [loadedSample, setLoadedSample] = useState<{ country: DemoCountry; companyName: string } | null>(null);

  const loadSample = (country: DemoCountry) => {
    const auth = useAuthStore.getState();
    if (!auth.isGuest || auth.user || !auth.currentWorkspaceId) return;
    if (!window.confirm('Replace the current in-memory demo records? This does not change a saved workspace.')) return;

    const sample = seedCountryDemoWorkspace(auth.currentWorkspaceId, country);
    const ledger = useLedgerStore.getState();
    ledger.setAccounts(sample.accounts);
    ledger.setCustomers(sample.customers);
    ledger.setVendors(sample.vendors);
    ledger.setTransactions(sample.transactions);
    ledger.setBaseCurrency(sample.currency);
    // Don't leave records from an earlier demo selection beside the new sample.
    ledger.setInvoices([]);
    ledger.setBills([]);
    ledger.setPayments([]);
    ledger.setCreditNotes([]);
    ledger.setVendorCredits([]);
    ledger.setEstimates([]);
    ledger.setBankLines([]);
    ledger.setJournalEntries([]);
    setLoadedSample({ country, companyName: sample.companyName });
  };

  const active = loadedSample
    ? `${loadedSample.country === 'IL' ? 'Israel · ILS' : 'United States · USD'} — ${loadedSample.companyName}`
    : 'Starter demo';
  return (
    <section aria-labelledby="guest-sample-title" className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-3">
      <div>
        <h2 id="guest-sample-title" className="font-semibold">Explore a sample company</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {active}. Synthetic 2025 records stay in this guest session only; no tax is calculated and nothing is saved to a real company.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-11 rounded-lg border border-[var(--line)] px-4 text-sm hover:border-[var(--brass)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brass)]" onClick={() => loadSample('IL')}>
          Try the Israel sample
        </button>
        <button type="button" className="min-h-11 rounded-lg border border-[var(--line)] px-4 text-sm hover:border-[var(--brass)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brass)]" onClick={() => loadSample('US')}>
          Try the US sample
        </button>
      </div>
    </section>
  );
}
