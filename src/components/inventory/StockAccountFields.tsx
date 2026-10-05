import { useId } from 'react';
import type { ChartAccount } from '../../types';
import { stockFieldClass as fieldClass, stockLabelClass as labelClass } from './stockStyles';

const accountLabel = (a: ChartAccount) => `${a.code ? `${a.code} - ` : ''}${a.name}`;

interface StockAccountFieldsProps {
  inventoryChoices: ChartAccount[];
  offsetChoices: ChartAccount[];
  inventoryAccountId: string;
  offsetAccountId: string;
  onInventoryChange: (id: string) => void;
  onOffsetChange: (id: string) => void;
  offsetLabel: string;
  date: string;
  onDateChange: (date: string) => void;
  note: string;
  onNoteChange: (note: string) => void;
}

/** The accounts, date and note shared by the stock adjustment and stock count dialogs. */
export function StockAccountFields(props: StockAccountFieldsProps) {
  const id = useId();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label htmlFor={`${id}-inv`} className={labelClass}>Inventory account</label>
        <select id={`${id}-inv`} value={props.inventoryAccountId} onChange={e => props.onInventoryChange(e.target.value)} className={fieldClass}>
          {!props.inventoryAccountId && <option value="">No Inventory account</option>}
          {props.inventoryChoices.map(a => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-off`} className={labelClass}>{props.offsetLabel}</label>
        <select id={`${id}-off`} value={props.offsetAccountId} onChange={e => props.onOffsetChange(e.target.value)} className={fieldClass}>
          {!props.offsetAccountId && <option value="">Choose an account…</option>}
          {props.offsetChoices.map(a => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-date`} className={labelClass}>Date</label>
        <input id={`${id}-date`} type="date" required value={props.date} onChange={e => props.onDateChange(e.target.value)} className={fieldClass} />
      </div>
      <div>
        <label htmlFor={`${id}-note`} className={labelClass}>Note (optional)</label>
        <input id={`${id}-note`} type="text" maxLength={200} value={props.note} onChange={e => props.onNoteChange(e.target.value)} className={fieldClass} />
      </div>
    </div>
  );
}
