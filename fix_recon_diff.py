import re

with open('src/components/ledger/Reconciliation.tsx', 'r') as f:
    content = f.read()

diff_ui = """                                   <span className="text-[8px] uppercase tracking-widest font-black text-slate-400 block mb-0.5">Assigned Target record</span>
                                   <p className="font-bold text-[var(--text)] truncate text-sm">{matchedLtx.description}</p>
                                   <p className="text-[10px] font-semibold text-slate-500 font-mono mt-0.5">{matchedLtx.date} • {formatCurrency(matchedLtx.totalAmountCents)}</p>
                                   {Math.abs(btx.amountCents) !== Math.abs(matchedLtx.totalAmountCents) && (
                                     <span className="text-[9px] text-amber-600 font-bold uppercase tracking-wider block mt-1 bg-amber-50/50 inline-block px-1.5 py-0.5 rounded border border-amber-200">
                                       Diff: {formatCurrency(Math.abs(Math.abs(btx.amountCents) - Math.abs(matchedLtx.totalAmountCents)))}
                                     </span>
                                   )}
"""

content = content.replace("""                                   <span className="text-[8px] uppercase tracking-widest font-black text-slate-400 block mb-0.5">Assigned Target record</span>
                                   <p className="font-bold text-[var(--text)] truncate text-sm">{matchedLtx.description}</p>
                                   <p className="text-[10px] font-semibold text-slate-500 font-mono mt-0.5">{matchedLtx.date} • {formatCurrency(matchedLtx.totalAmountCents)}</p>""", diff_ui)


diff_ui_main = """                                   <span className="text-[9px] uppercase tracking-widest font-black text-indigo-400 block mb-0.5 mt-1">Heuristic Match Detected</span>
                                   <p className="font-bold text-[var(--text)] truncate text-sm">{matchedLtx.description}</p>
                                   <p className="text-[11px] font-medium text-slate-500 font-mono">{matchedLtx.date} • {formatCurrency(matchedLtx.totalAmountCents)}</p>
                                   {Math.abs(btx.amountCents) !== Math.abs(matchedLtx.totalAmountCents) && (
                                     <span className="text-[9px] text-amber-600 font-bold uppercase tracking-wider block mt-1 bg-amber-50/50 inline-block px-1.5 py-0.5 rounded border border-amber-200">
                                       Diff: {formatCurrency(Math.abs(Math.abs(btx.amountCents) - Math.abs(matchedLtx.totalAmountCents)))}
                                     </span>
                                   )}
"""
content = content.replace("""                                   <span className="text-[9px] uppercase tracking-widest font-black text-indigo-400 block mb-0.5 mt-1">Heuristic Match Detected</span>
                                   <p className="font-bold text-[var(--text)] truncate text-sm">{matchedLtx.description}</p>
                                   <p className="text-[11px] font-medium text-slate-500 font-mono">{matchedLtx.date} • {formatCurrency(matchedLtx.totalAmountCents)}</p>""", diff_ui_main)

with open('src/components/ledger/Reconciliation.tsx', 'w') as f:
    f.write(content)
