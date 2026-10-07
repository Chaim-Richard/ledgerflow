import React from 'react';
import type { FixedAsset } from '../../types';
import { RecordInlineField } from '../ui/RecordInlineField';
import { assetRemindersDue, reminderText } from '../../lib/assetReminders';
import { getLocalDateISO } from '../../lib/utils';

const TEXT_FIELDS = [['name', 'Name'], ['location', 'Location'], ['category', 'Category']] as const;
/** X-08: the warranty and insurance dates, reminded 30 days before (src/lib/assetReminders.ts). */
const DATE_FIELDS = [['warrantyExpires', 'Warranty ends', 'Add warranty end'], ['insuranceRenews', 'Insurance renews', 'Add insurance renewal']] as const;

export function AssetInlineDetails({ asset }: { asset: FixedAsset & { location?: string; category?: string } }) {
  const due = assetRemindersDue(asset, getLocalDateISO());
  return (
    <div className="flex flex-col gap-1">
      {TEXT_FIELDS.map(([field, label]) => <RecordInlineField key={field} collection="assets" record={asset} field={field} label={`${label} of ${asset.name}`} placeholder={`Add ${field}`} />)}
      {DATE_FIELDS.map(([field, label, placeholder]) => (
        <div key={field} className="flex items-center gap-1 text-[11px] font-normal text-[var(--muted)]">
          <span aria-hidden="true">{label}:</span>
          <RecordInlineField collection="assets" record={asset} field={field} kind="date" label={`${label} for ${asset.name}`} placeholder={placeholder} />
        </div>
      ))}
      {due.map(r => <p key={r.kind} className="text-[11px] font-semibold text-amber-700">{reminderText(asset.name, r)}</p>)}
    </div>
  );
}
