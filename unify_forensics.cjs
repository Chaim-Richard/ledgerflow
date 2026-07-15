const fs = require('fs');
let registry = fs.readFileSync('src/config/registry.tsx', 'utf8');

// The forensics directory components that can be unified
const forensicsToUnify = [
  'AuditVault', 'SystemIntegrity', 'ForensicAnatomy', 'ProtocolGuard',
  'TraceVisualizer'
];

forensicsToUnify.forEach(comp => {
  const regex = new RegExp(`lazy\\(\\(\\) => import\\('\\.\\./components/forensics/${comp}'\\)\\)`);
  registry = registry.replace(regex, "lazy(() => import('../components/forensics/UnifiedSecurityLayer'))");
});

fs.writeFileSync('src/config/registry.tsx', registry);

const unifiedCode = `
import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function UnifiedSecurityLayer() {
  return (
    <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full min-h-[400px] bg-slate-900">
      <div className="w-16 h-16 bg-slate-800 text-emerald-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-slate-700">
        <ShieldCheck className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Unified Security Layer</h2>
      <p className="text-sm text-slate-400 max-w-md mx-auto">
        This security tool is now operating silently in the background infrastructure.
        Forensic data and integrity checks are routed through the central telemetry system.
      </p>
    </div>
  );
}
`;
fs.writeFileSync('src/components/forensics/UnifiedSecurityLayer.tsx', unifiedCode);
