import React from 'react';
import type { FixedAsset } from '../../types';
import { RecordInlineField } from '../ui/RecordInlineField';
import { assetRemindersDue, reminderText } from '../../lib/assetReminders';
import { getLocalDateISO } from '../../lib/utils';
import { MaintenanceLog } from './MaintenanceLog';
import { assetTagAdapter } from '../../lib/assetTagAdapter';

const TEXT_FIELDS = [['name', 'Name'], ['assetTag', 'Tag'], ['location', 'Location'], ['category', 'Category']] as const;
/** X-08, X-06: the warranty, insurance and next service dates, reminded 30 days before (src/lib/assetReminders.ts). */
const DATE_FIELDS = [['warrantyExpires', 'Warranty ends', 'Add warranty end'], ['insuranceRenews', 'Insurance renews', 'Add insurance renewal'], ['nextServiceDue', 'Next service', 'Add next service']] as const;

export function AssetInlineDetails({ asset, currency = 'USD' }: { asset: FixedAsset & { location?: string; category?: string }; currency?: string }) {
  const due = assetRemindersDue(asset, getLocalDateISO());
  return (
    <div className="flex flex-col gap-1">
      {TEXT_FIELDS.map(([field, label]) => <RecordInlineField key={field} collection="assets" record={asset} field={field} adapter={field === 'assetTag' ? assetTagAdapter : undefined} label={`${label} of ${asset.name}`} placeholder={`Add ${field}`} />)}
      {DATE_FIELDS.map(([field, label, placeholder]) => (
        <div key={field} className="flex items-center gap-1 text-[11px] font-normal text-[var(--muted)]">
          <span aria-hidden="true">{label}:</span>
          <RecordInlineField collection="assets" record={asset} field={field} kind="date" label={`${label} for ${asset.name}`} placeholder={placeholder} />
        </div>
      ))}
      {due.map(r => <p key={r.kind} className="text-[11px] font-semibold text-amber-700">{reminderText(asset.name, r)}</p>)}
      <MaintenanceLog asset={asset} currency={currency} />
    </div>
  );
}
