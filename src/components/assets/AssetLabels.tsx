import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useDialog } from '../../hooks/useDialog';
import type { FixedAsset } from '../../types';

/**
 * Printable asset labels (X-07): each tagged asset's name and tag with a QR code of the tag (read
 * back by a phone camera into the register's search). Print from here; only the labels print.
 */
export default function AssetLabels({ assets, company, onClose }: { assets: Array<FixedAsset & { assetTag?: string }>; company: string; onClose: () => void }) {
  const { dialogProps, titleId } = useDialog(onClose, true);
  const tagged = assets.filter(a => a.assetTag);
  const [codes, setCodes] = useState<Record<string, string>>({});
  // the tags to draw, as one key (the effect reads them back from it)
  const tagKey = tagged.map(a => `${a.id}\t${a.assetTag}`).join('\n');
  useEffect(() => {
    let live = true;
    const wanted = tagKey ? tagKey.split('\n').map(row => row.split('\t')) : [];
    Promise.all(wanted.map(async ([id, tag]) => [id, await QRCode.toDataURL(tag, { margin: 1, width: 160 })] as const))
      .then(pairs => { if (live) setCodes(Object.fromEntries(pairs)); })
      .catch(() => { if (live) setCodes({}); });
    return () => { live = false; };
  }, [tagKey]);

  return (
    <div {...dialogProps} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:static print:bg-white print:p-0">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-[var(--surface)] p-4 print:max-h-none print:overflow-visible print:shadow-none">
        <div className="flex items-center justify-between gap-2 mb-3 print:hidden">
          <h2 id={titleId} className="text-sm font-bold text-[var(--text)]">Asset labels ({tagged.length})</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.print()} disabled={tagged.length === 0} className="rounded-lg bg-[var(--brass)] px-3 py-1.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-50">Print</button>
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm">Close</button>
          </div>
        </div>
        {tagged.length === 0 && <p className="text-sm text-[var(--muted)]">No asset has a tag yet: use "Give tags" first.</p>}
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {tagged.map(a => (
            <li key={a.id} className="flex items-center gap-2 rounded border border-[var(--line)] p-2 break-inside-avoid">
              {codes[a.id] ? <img src={codes[a.id]} alt={`QR code of ${a.assetTag}`} className="w-16 h-16" /> : <span className="w-16 h-16" aria-hidden="true" />}
              <span className="min-w-0 text-xs">
                <span className="block font-mono font-bold text-[var(--text)]">{a.assetTag}</span>
                <bdi className="block truncate text-[var(--text)]">{a.name}</bdi>
                <bdi className="block truncate text-[var(--muted)]">{company}</bdi>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
