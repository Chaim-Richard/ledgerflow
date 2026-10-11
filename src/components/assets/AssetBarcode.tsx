import React from 'react';
import { code128Geometry, code128Problem } from '../../lib/code128';

/** Black bars on a white background, including the scanner's quiet zones, in every theme. */
export default function AssetBarcode({ tag }: { tag: string }) {
  const problem = code128Problem(tag);
  // Preserve existing non-ASCII tags; the QR label still works. Never silently rewrite identity.
  if (problem) return <p className="text-xs text-[var(--muted)]">Code 128 unavailable for this tag; use its QR code.</p>;
  const { width, bars } = code128Geometry(tag);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`Code 128 barcode of ${tag}`}
      viewBox={`0 0 ${width} 44`} className="w-full h-11" shapeRendering="crispEdges" style={{ direction: 'ltr' }}>
      <rect width={width} height={44} fill="#fff" />
      {bars.map(bar => <rect key={bar.x} x={bar.x} y={2} width={bar.width} height={40} fill="#000" />)}
    </svg>
  );
}
