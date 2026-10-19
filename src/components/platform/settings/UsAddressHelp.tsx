import { useId, useState } from 'react';
import { parseUsStateAndZip, US_POSTAL_REGIONS, type UsAddressProblem } from '../../../lib/usAddressStateZip';

const problems: Record<UsAddressProblem, string> = {
  'no-region': 'Add a recognizable state beside the ZIP on the final address line.',
  'invalid-region': 'Review the state name or two-letter code.',
  'invalid-zip': 'Review the ZIP: use five digits, optionally followed by four more after a hyphen.',
  'foreign-country': 'This address is outside the US; review it without this helper.',
  'ambiguous-address': 'More than one address was found. Enter one address at a time.',
  'conflicting-fields': 'The address fields disagree; review them before copying.',
  'military-mail': 'Military mail needs review; no state is copied automatically.',
};

export default function UsAddressHelp({ onUse }: { onUse: (value: { state: string; postalCode: string }) => void }) {
  const [address, setAddress] = useState('');
  const helpId = useId(), addressId = useId();
  const result = parseUsStateAndZip({ address, country: 'US' });
  const canUse = result.status === 'parsed' && result.regionKind === 'state' && Boolean(result.state && result.postalCode);
  function copy() {
    if (result.status === 'parsed' && result.regionKind === 'state' && result.state && result.postalCode)
      onUse({ state: result.state, postalCode: result.postalCode });
  }
  return <details className="rounded border p-3 min-w-0 space-y-2">
    <summary className="min-h-11 cursor-pointer">Read state and ZIP from a US address</summary>
    <label htmlFor={addressId} className="block">US address to read</label>
      <textarea id={addressId} rows={3} dir="auto" value={address} aria-describedby={helpId}
        onChange={event => setAddress(event.target.value)}
        className="min-h-11 w-full rounded border bg-[var(--surface)] text-[var(--text)] p-2" />
    <p id={helpId} className="text-sm text-[var(--muted)]">Local recognition only. This does not verify delivery, residency, ZIP/state agreement or tax jurisdiction. Only state and ZIP are copied into your draft; review city, county and district before saving.</p>
    <p role="status" className="text-sm break-words">{result.issue ? problems[result.issue]
      : canUse && result.state ? <>Recognized: <bdi dir="ltr">{US_POSTAL_REGIONS[result.state]} ({result.state})</bdi> · ZIP <bdi dir="ltr">{result.postalCode}</bdi>.</>
      : address.trim() ? 'A state and complete ZIP are needed. Territories require manual review.' : 'Enter one address to see a suggestion.'}</p>
    <button type="button" disabled={!canUse} onClick={copy}
      className="min-h-11 rounded border px-3 disabled:opacity-50">Use state and ZIP in draft</button>
  </details>;
}
