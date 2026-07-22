import os

with open('src/components/Dashboard.tsx', 'r') as f:
    code = f.read()

target = """            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-white uppercase font-sans">Clearbook Automated Insights</h2>
              <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">LIVE CO-PILOT</span>
            </div>"""

replacement = """            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-white uppercase font-sans">Clearbook Automated Insights</h2>
              <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">LIVE CO-PILOT</span>
              {activeScenarioId !== 'default-scenario' && (
                <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
                  BRANCH: {scenarios.find(s => s.id === activeScenarioId)?.name}
                </span>
              )}
            </div>"""

code = code.replace(target, replacement)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(code)
