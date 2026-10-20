import { useId } from 'react';
import { checkVatNumber, vatFormatWarning } from '../../../lib/tax/vatNumberFormat';

/** Optional, local-only guidance for an explicitly recorded VAT registration country. */
export default function VatNumberHelp({ value, country }: { value: string; country: string }) {
  const helpId = useId();
  const check = checkVatNumber(value, country);
  return <details className="min-w-0 rounded border border-[var(--line)] p-2">
    <summary className="min-h-11 cursor-pointer content-center rounded focus-visible:outline focus-visible:outline-2" aria-describedby={helpId}>EU / UK VAT number format</summary>
    <p id={helpId} className="text-sm text-[var(--muted)]">Uses the registration country below, not the books’ country or a guessed number prefix. This local format check does not verify issuance, ownership, active registration or a checksum. No VIES/HMRC lookup is made. It does not change the number, block saving, or determine tax treatment. EU / UK tax calculations and filing are not verified.</p>
    <p role="status" className="text-sm break-words">
      {vatFormatWarning(check) || (check.status === 'valid-format'
        ? <>Format matches: <bdi dir="ltr">{check.masked}</bdi>. Registration is not verified.</>
        : 'Enter a registration number above and a supported EU / UK registration country below to check its format.')}
    </p>
  </details>;
}
