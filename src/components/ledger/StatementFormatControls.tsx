/**
 * E-26/E-43: the bank-format controls of the statement importer, kept in their own file so the
 * importer stays readable (it was over the project's 800-line limit). Each choice is deliberate:
 * a file is only read by a parser the user picked, and the date order is never inferred.
 */
import type { QIFDateOrder } from '../../lib/qifParser';
import type { UsBankCsvFormat } from '../../lib/usBankCsv';
import type { IsraeliBankDateOrder } from '../../lib/israeliBankCsv';
import { Labelled } from '../ui/Labelled';

const selectClass = 'min-h-11 px-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-sm text-[var(--text)]';

export interface StatementFormatControlsProps {
  disabled: boolean;
  qifDateOrder: QIFDateOrder | '';
  onQifDateOrder: (value: QIFDateOrder | '') => void;
  usBankCsvFormat: UsBankCsvFormat | '';
  onUsBankCsvFormat: (value: UsBankCsvFormat | '') => void;
  israeliBankCsv: boolean;
  onIsraeliBankCsv: (value: boolean) => void;
  israeliDateOrder: IsraeliBankDateOrder | '';
  onIsraeliDateOrder: (value: IsraeliBankDateOrder | '') => void;
}

export default function StatementFormatControls({
  disabled, qifDateOrder, onQifDateOrder, usBankCsvFormat, onUsBankCsvFormat,
  israeliBankCsv, onIsraeliBankCsv, israeliDateOrder, onIsraeliDateOrder,
}: StatementFormatControlsProps) {
  return (
    <>
      <Labelled label="QIF date order">
        <select aria-label="QIF date order" value={qifDateOrder} onChange={e => onQifDateOrder(e.target.value as QIFDateOrder | '')} disabled={disabled} className={selectClass}>
          <option value="">Choose for QIF files…</option>
          <option value="mdy">Month / day / year</option>
          <option value="dmy">Day / month / year</option>
        </select>
      </Labelled>
      <Labelled label="US bank CSV layout">
        <select aria-label="US bank CSV layout" value={usBankCsvFormat} onChange={e => onUsBankCsvFormat(e.target.value as UsBankCsvFormat | '')} disabled={disabled} className={selectClass}>
          <option value="">Other CSV: review column mapping</option>
          <option value="chase-checking">Chase checking / savings</option>
          <option value="chase-card">Chase credit card</option>
          <option value="boa-checking">Bank of America checking / savings</option>
          <option value="boa-card">Bank of America credit card</option>
          <option value="wells-fargo-checking">Wells Fargo checking / savings (no header)</option>
        </select>
      </Labelled>
      <Labelled label="Israeli bank CSV">
        <select aria-label="Israeli bank CSV" value={israeliBankCsv ? 'israeli' : ''} onChange={e => onIsraeliBankCsv(e.target.value === 'israeli')} disabled={disabled} className={selectClass}>
          <option value="">Not an Israeli bank file</option>
          <option value="israeli">Israeli bank activity CSV (Hebrew or English headers)</option>
        </select>
      </Labelled>
      {israeliBankCsv && (
        <Labelled label="Statement date order">
          <select aria-label="Statement date order" value={israeliDateOrder} onChange={e => onIsraeliDateOrder(e.target.value as IsraeliBankDateOrder | '')} disabled={disabled} className={selectClass}>
            <option value="">Choose before uploading…</option>
            <option value="dmy">Day / month / year (31/12/2024)</option>
            <option value="mdy">Month / day / year (12/31/2024)</option>
          </select>
        </Labelled>
      )}
      <p className="text-xs text-[var(--muted)]">
        Israeli bank files are read by their column names (תאריך, תיאור, אסמכתא, חובה, זכות or a single סכום), never by column
        position or bank name; the date order is yours to choose and is never guessed. A total or opening/closing-balance line
        is refused rather than imported. Choose a US bank layout only for its matching CSV export; Wells Fargo CSV has no
        header, so the first row is a transaction. Unknown layouts should use manual mapping, not guesswork. QIF, BAI2,
        OFX/QFX and CAMT.053 use separate parsers; XML uploads must be a single-account CAMT.053 statement. Bank-specific
        imports need a two-decimal workspace currency. All entries go to review before import.
      </p>
    </>
  );
}
