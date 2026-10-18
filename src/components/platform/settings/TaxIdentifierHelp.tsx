import { useId, useState } from 'react';
import { checkIsraeliIdentifier, israeliIdentifierWarning } from '../../../lib/tax/israeliIdentifiers';
import { checkUsTaxId, usTaxIdWarning } from '../../../lib/tax/usTaxIdFormat';

type Format = '' | 'identity' | 'company' | 'ein' | 'ssn';

/** Optional local guidance: never infers an ID type or changes the registration. */
export default function TaxIdentifierHelp({ value }: { value: string }) {
  const [format, setFormat] = useState<Format>('');
  const helpId = useId();
  const check = format === 'identity' || format === 'company'
    ? checkIsraeliIdentifier(value, format)
    : format ? checkUsTaxId(value, format) : null;
  const warning = !format ? null : format === 'identity' || format === 'company'
    ? israeliIdentifierWarning(checkIsraeliIdentifier(value, format))
    : usTaxIdWarning(checkUsTaxId(value, format));
  return <div className="space-y-2 min-w-0">
    <label className="block">Check number as
      <select className="min-h-11 w-full rounded border bg-[var(--surface)] px-2"
        value={format} aria-describedby={helpId} onChange={event => setFormat(event.target.value as Format)}>
        <option value="">No format check</option>
        <option value="identity">Israeli identity number</option>
        <option value="company">Israeli company number</option>
        <option value="ein">US EIN</option>
        <option value="ssn">US SSN</option>
      </select>
    </label>
    <p id={helpId} className="text-sm text-[var(--muted)]">Choose the identifier type from your document. This local format/check-digit check does not verify issuance, ownership or tax registration. It does not change the number or block saving.</p>
    <p role="status" className="text-sm break-words">
      {warning || (check?.state === 'valid-format'
        ? <>Format matches: <bdi dir="ltr">{check.masked}</bdi>. Registration is not verified.</>
        : format ? 'Enter a registration number above to check its format.' : '')}
    </p>
  </div>;
}
