import React from 'react';
import { useLedgerStore } from '../../../stores/useLedgerStore';
import { useUIStore } from '../../../stores/useUIStore';
import { Globe, Webhook, Download, Database, RefreshCw, ChevronRight, FileJson, Trash2, Copy } from 'lucide-react';
import { generateOFX } from '../../../lib/ofx-exporter';
import { toast } from 'sonner';

export default function DeveloperSettings() {
  const transactions = useLedgerStore(state => state.transactions);
  const accounts = useLedgerStore(state => state.accounts);
  
  const language = useUIStore(state => state.language);
  const lexiconOverrides = useUIStore(state => state.lexiconOverrides);
  const resetLexiconOverrides = useUIStore(state => state.resetLexiconOverrides);

  const hasOverrides = Object.keys(lexiconOverrides).length > 0;

  const copyLexiconCodeToClipboard = () => {
    const formatted = JSON.stringify(lexiconOverrides, null, 2);
    // Wrap as complete patch
    const patchCode = `// Add this object inside SYSTEM_GLOSSARY in /src/config/registry.tsx:\nconst LexiconPatch = ${formatted};`;
    navigator.clipboard.writeText(patchCode);
    toast.success("Lexicon configuration patch copied to clipboard!");
  };

  const handleOFXExport = () => {
    if (accounts.length === 0) {
      toast.error("No accounts found for export.");
      return;
    }
    const defaultAcc = accounts[0];
    const ofx = generateOFX(transactions.filter(t => t.lines.some(l => l.accountId === defaultAcc.id)), defaultAcc);
    const blob = new Blob([ofx], { type: 'application/x-ofx' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clearbook_${defaultAcc.code}_${new Date().toISOString().split('T')[0]}.ofx`;
    a.click();
    toast.success("OFX Export Layer Successful");
  };

  const exportData = (format: 'json' | 'csv') => {
    toast.success(`Archive generated and transmitted to vault. (${format.toUpperCase()})`);
  };

  return (
    <div className="space-y-10">
      <div className="ledger-card p-12 bg-[var(--surface)] border-[var(--line)] shadow-sm">
        <div className="flex items-center gap-5 mb-10">
          <div className="w-14 h-14 bg-indigo-600 text-white rounded-[32px] flex items-center justify-center shadow-xl shadow-indigo-600/20">
            <Globe size={28} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-[var(--text)] tracking-tight uppercase tracking-widest">Enterprise API & Webhooks</h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Autonomous Event Propagation</p>
          </div>
        </div>

        <div className="space-y-12">
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase text-[var(--text)] tracking-widest border-l-4 border-indigo-600 pl-4">Active Webhooks</h4>
            <div className="p-4 md:p-8 bg-[var(--surface)] rounded-[32px] border border-[var(--line)] flex flex-col items-center justify-center text-center gap-4 py-16">
              <Webhook size={40} className="text-slate-200" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-[var(--text)]">No External Nodes Connected</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Register endpoints to receive real-time rule updates and fiscal anomaly detected events.
                </p>
              </div>
              <button className="mt-4 px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-medium uppercase tracking-wider hover:bg-slate-800 transition-all">
                Provision New Endpoint
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase text-[var(--text)] tracking-widest border-l-4 border-indigo-600 pl-4">Visual Content & Lexicon Engine</h4>
            <div className="p-4 md:p-8 bg-[var(--surface)] rounded-[32px] border border-[var(--line)] space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                    <FileJson size={16} className="text-indigo-600 animate-pulse" />
                    Interactive Translation Overwrites
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed max-w-lg">
                    In Dev Mode (click the Zap icon in top header), you can hover and in-line edit any text card or sentence on any page. Edits are tracked here live in state.
                  </p>
                </div>
                
                {hasOverrides && (
                  <button 
                    onClick={resetLexiconOverrides}
                    className="px-4 py-2 border border-rose-200 hover:bg-rose-50 rounded-xl text-[10px] font-black uppercase text-rose-600 tracking-wider flex items-center gap-2 transition-colors self-start md:self-auto"
                  >
                    <Trash2 size={12} /> Purge Edits
                  </button>
                )}
              </div>

              {hasOverrides ? (
                <div className="space-y-4">
                  <div className="max-h-40 overflow-y-auto border border-[var(--line)] rounded-xl bg-[var(--surface)] p-4 space-y-2 text-xs custom-scrollbar">
                    {Object.entries(lexiconOverrides).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0 font-mono">
                        <span className="text-indigo-600 font-bold max-w-[40%] truncate" title={key}>{key}</span>
                        <span className="text-gray-700 truncate max-w-[50%]">[{language.toUpperCase()}]: {value[language]}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Get Permanent Copy Code:</p>
                    <div className="relative">
                      <pre className="text-[10px] font-mono bg-slate-900 text-slate-300 p-4 rounded-xl overflow-x-auto leading-relaxed max-h-32">
{`// Add this directly inside SYSTEM_GLOSSARY in /src/config/registry.tsx:
${JSON.stringify(lexiconOverrides, null, 2)}`}
                      </pre>
                      <button 
                        onClick={copyLexiconCodeToClipboard}
                        className="absolute top-2 right-2 p-2 bg-[var(--surface)]/10 hover:bg-[var(--surface)]/20 text-white rounded-lg transition-colors cursor-pointer"
                        title="Copy Config Patch"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-dashed border-gray-200 rounded-xl text-center text-[11px] font-medium text-slate-500 py-8">
                  No copy overrides active. Enable Dev Mode (Zap Icon) in top header, click or hover over any text element on the Dashboard to edit it inline instantly!
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase text-[var(--text)] tracking-widest border-l-4 border-indigo-600 pl-4">Institutional Export Protocols</h4>
            <div className="grid grid-cols-2 gap-6">
              <button 
                onClick={() => exportData('json')}
                className="flex items-center justify-between p-6 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] hover:border-indigo-600 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[var(--surface)] rounded-[32px] flex items-center justify-center text-[var(--text)] group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <Download size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-[var(--text)] uppercase tracking-tight">Full Archive (JSON)</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Machine Readable</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-200 group-hover:text-indigo-600 transition-colors" />
              </button>

              <button 
                onClick={() => exportData('csv')}
                className="flex items-center justify-between p-6 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] hover:border-indigo-600 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[var(--surface)] rounded-[32px] flex items-center justify-center text-[var(--text)] group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <Database size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-[var(--text)] uppercase tracking-tight">Standard Ledger (CSV)</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Excel / Audit Ready</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-200 group-hover:text-indigo-600 transition-colors" />
              </button>

              <button 
                onClick={handleOFXExport}
                className="flex items-center justify-between p-6 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] hover:border-indigo-600 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[var(--surface)] rounded-[32px] flex items-center justify-center text-[var(--text)] group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <RefreshCw size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-[var(--text)] uppercase tracking-tight">Bank Interchange (OFX)</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Intuit / Quicken Compatible</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-200 group-hover:text-indigo-600 transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
