import re

with open('src/components/system/ArchitectureViewer.tsx', 'r') as f:
    content = f.read()

# Replace the algorithms map to group by domain
new_algo_map = """
            <div className="flex flex-col gap-8">
              {['finance', 'operations', 'forensics', 'planning', 'treasury', 'system', 'uncategorized'].map(domain => {
                const domainAlgos = filteredAlgos.filter((a: any) => (a.domain || 'uncategorized') === domain);
                if (domainAlgos.length === 0) return null;
                return (
                  <div key={domain} className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      {domain} ({domainAlgos.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {domainAlgos.map((algo: any) => (
                        <div key={algo.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all flex flex-col h-full group">
                          <div className="flex-grow">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-bold text-slate-800 text-sm group-hover:text-emerald-700 transition-colors">{algo.name}</h3>
                              <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">ID: {algo.id}</span>
                            </div>
                            <p className="text-xs text-slate-500 mb-4">{algo.description}</p>
                            
                            {algo.tags && algo.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-4">
                                {algo.tags.map((tag: string) => (
                                  <span key={tag} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] rounded uppercase font-bold tracking-wider">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {algo.inputs && algo.inputs.length > 0 && (
                            <div className="mt-auto pt-3 border-t border-slate-100">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Required Inputs</div>
                              <div className="flex flex-wrap gap-1.5">
                                {algo.inputs.map((input: any) => (
                                  <span key={input.key} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium border border-emerald-100">
                                    {input.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
"""

# Replace the grid in activeTab === 'algorithms'
content = re.sub(
    r'<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">.*?</div>\s*</motion\.div>',
    new_algo_map + '\n          </motion.div>',
    content,
    flags=re.DOTALL
)

with open('src/components/system/ArchitectureViewer.tsx', 'w') as f:
    f.write(content)
