import React from 'react';
import type { FixedAsset } from '../../types';
import { RecordInlineField } from '../ui/RecordInlineField';
export function AssetInlineDetails({ asset }: { asset: FixedAsset & { location?: string; category?: string } }) {
 return <div className="flex flex-col gap-1">{(['name', 'location', 'category'] as const).map(field => <RecordInlineField key={field} collection="assets" record={asset} field={field} label={`${field === 'name' ? 'Name' : field === 'location' ? 'Location' : 'Category'} of ${asset.name}`} placeholder={`Add ${field}`} />)}</div>;
}
