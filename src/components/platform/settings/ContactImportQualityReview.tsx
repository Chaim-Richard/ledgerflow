import React, { useId, useMemo, useState } from 'react';
import type { ContactImportCleanupResult } from '../../../lib/contactImportCleanup';
import { ISO_COUNTRIES, isoCountryOptionLabel } from '../../../lib/isoCountryReference';
import { parseIsraeliAddress } from '../../../lib/israelAddressParser';
import type { ImportKind, ImportRow } from '../../../lib/recordImport';
import { useUIStore } from '../../../stores/useUIStore';

const field = 'min-h-11 rounded border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--text)]';

/** E-36/E-37 contact-only suggestions inside the existing Settings → Import data screen. */
export default function ContactImportQualityReview({
  kind,
  sourceRows,
  cleanup,
  phoneCountry,
  onPhoneCountryChange,
  acceptEmailSuggestions,
  acceptPhoneSuggestions,
  onAcceptEmailSuggestionsChange,
  onAcceptPhoneSuggestionsChange,
}: {
  kind: Extract<ImportKind, 'customers' | 'vendors'>;
  sourceRows: readonly ImportRow[];
  cleanup: ContactImportCleanupResult;
  phoneCountry: string;
  onPhoneCountryChange: (country: string) => void;
  acceptEmailSuggestions: boolean;
  acceptPhoneSuggestions: boolean;
  onAcceptEmailSuggestionsChange: (accepted: boolean) => void;
  onAcceptPhoneSuggestionsChange: (accepted: boolean) => void;
}) {
  const id = useId();
  const language = useUIStore(state => state.language);
  const [showIsraelSuggestions, setShowIsraelSuggestions] = useState(false);
  const addressRows = useMemo(() => sourceRows
    .map((row, index) => ({ row: index + 2, original: String(row.address ?? ''), suggestion: parseIsraeliAddress(row.address) }))
    .filter(entry => entry.original.trim()), [sourceRows]);
  const shownAddresses = addressRows.slice(0, 20);
  const shownWarnings = cleanup.warnings.slice(0, 20);
  const emailSuggestionCount = cleanup.warnings.filter(warning => warning.field === 'Email' && warning.normalized !== undefined).length;
  const phoneSuggestionCount = cleanup.warnings.filter(warning => warning.field === 'Phone' && warning.normalized !== undefined).length;

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 space-y-3">
      <div>
        <h4 id={`${id}-title`} className="text-sm font-semibold text-[var(--text)]">{kind === 'customers' ? 'Customer' : 'Vendor'} data review</h4>
        <p className="text-xs text-[var(--muted)]">Phone and email suggestions do not block the import and are never applied by default. Choose the suggestions you want to use for this import; unchecked mapped values remain unchanged. The usual importer still validates email syntax.</p>
      </div>

      <div className="space-y-1">
        <label htmlFor={`${id}-phone-country`} className="block text-xs font-semibold text-[var(--text)]">Country for local phone numbers</label>
        <select id={`${id}-phone-country`} value={phoneCountry} onChange={event => onPhoneCountryChange(event.target.value)} className={`${field} w-full sm:max-w-xl`}>
          <option value="">Do not infer a country</option>
          {ISO_COUNTRIES.map(country => <option key={country.alpha2} value={country.alpha2}>{isoCountryOptionLabel(country, language)}</option>)}
        </select>
        <p className="text-xs text-[var(--muted)]">An explicit country is used only to suggest local-number formatting as E.164; the suggestion is used only if accepted below. Numbers starting with + need no country choice. Unparseable numbers and extensions are kept as entered.</p>
      </div>

      {cleanup.warnings.length > 0 ? (
        <div role="region" aria-live="polite" aria-label="Contact cleanup suggestions">
          <p className="text-xs font-semibold text-[var(--text)]">{cleanup.warnings.length} cleanup note{cleanup.warnings.length === 1 ? '' : 's'}; the import is not blocked by these suggestions.</p>
          <ul className="mt-1 max-h-48 overflow-auto space-y-1 text-xs text-[var(--muted)]">
            {shownWarnings.map(warning => (
              <li key={`${warning.row}:${warning.field}`}>
                Row {warning.row}, {warning.field}: <bdi>{warning.original}</bdi>
                {warning.normalized !== undefined && <> → <bdi>{warning.normalized}</bdi></>}. {warning.message}
              </li>
            ))}
          </ul>
          {cleanup.warnings.length > shownWarnings.length && <p className="mt-1 text-xs text-[var(--muted)]">Showing the first {shownWarnings.length} notes.</p>}
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)]">No email or phone cleanup notes for the mapped contacts. Values remain as provided.</p>
      )}

      {emailSuggestionCount > 0 && (
        <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            checked={acceptEmailSuggestions}
            onChange={event => onAcceptEmailSuggestionsChange(event.target.checked)}
          />
          Apply {emailSuggestionCount} suggested email cleanup{emailSuggestionCount === 1 ? '' : 's'} to this import (trim and lowercase)
        </label>
      )}
      {phoneSuggestionCount > 0 && (
        <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            checked={acceptPhoneSuggestions}
            onChange={event => onAcceptPhoneSuggestionsChange(event.target.checked)}
          />
          Apply {phoneSuggestionCount} suggested phone cleanup{phoneSuggestionCount === 1 ? '' : 's'} to this import (E.164)
        </label>
      )}
      {(emailSuggestionCount > 0 || phoneSuggestionCount > 0) && (
        <p className="text-xs text-[var(--muted)]">A checked option applies the full count shown for that field (the review list displays at most 20 notes). Only checked suggestions replace source values, and only for this import.</p>
      )}

      <div className="space-y-2 border-t border-[var(--line)] pt-3">
        <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--text)]">
          <input type="checkbox" checked={showIsraelSuggestions} onChange={event => setShowIsraelSuggestions(event.target.checked)} />
          Suggest Israeli address parts (preview only)
        </label>
        <p className="text-xs text-[var(--muted)]">The parser recognizes common Hebrew/English street labels and labelled five- or seven-digit postal codes. It never verifies an address, changes the original address, or determines tax treatment.</p>
        {showIsraelSuggestions && (
          <div aria-label="Israeli address suggestions" className="space-y-2">
            {addressRows.length === 0 ? <p className="text-xs text-[var(--muted)]">No address column is mapped for these contacts.</p> : (
              <>
                <p className="text-xs text-[var(--muted)]">Address suggestions for {addressRows.length} row{addressRows.length === 1 ? '' : 's'}; the import will retain each original address as entered.</p>
                {shownAddresses.map(entry => (
                  <article key={entry.row} className="rounded border border-[var(--line)] p-2 text-xs space-y-1">
                    <p><strong>Row {entry.row} — original:</strong> <bdi dir="auto">{entry.original}</bdi></p>
                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                      <div><dt className="font-semibold">Street suggestion</dt><dd><bdi dir="auto">{entry.suggestion.street || 'Not separated'}</bdi></dd></div>
                      <div><dt className="font-semibold">City suggestion</dt><dd><bdi dir="auto">{entry.suggestion.city || 'Not separated'}</bdi></dd></div>
                      <div><dt className="font-semibold">Postal-code suggestion</dt><dd className="font-mono">{entry.suggestion.postalCode || 'Not separated'}</dd></div>
                    </dl>
                    {entry.suggestion.warnings.length > 0 && <p className="text-[var(--muted)]">{entry.suggestion.warnings.join(' ')}</p>}
                  </article>
                ))}
                {addressRows.length > shownAddresses.length && <p className="text-xs text-[var(--muted)]">Showing the first {shownAddresses.length} address suggestions.</p>}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
