import sys

def patch():
    with open('src/components/platform/SystemCommandCenter.tsx', 'r') as f:
        content = f.read()

    # 1. Clean up activeFormTab
    if " | 'lexicon'" in content:
        content = content.replace(" | 'lexicon'", "")
        
    button_target = """                    <button
                      type="button"
                      onClick={() => setActiveFormTab('lexicon')}
                      className={cn(
                        "px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap",
                        activeFormTab === 'lexicon' 
                           ? "bg-[#0047AB]/10 text-[#0047AB] border border-[#0047AB]/20" 
                           : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <BookA size={12} /> Lexicon
                    </button>"""
    if button_target in content:
        content = content.replace(button_target, "")
        
    # There might be two due to my mess up earlier.
    content = content.replace(button_target, "")
        
    form_target = """                    {activeFormTab === 'lexicon' && (
                      <div className="space-y-4 text-left">
                        <div className="p-4 bg-[#0047AB]/5 rounded-[32px] border border-[#0047AB]/10 flex items-center gap-3">
                          <BookA size={24} className="text-[#0047AB]" />
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">System Lexicon Override</h4>
                            <p className="text-xs text-slate-500">Edit hardcoded text values across the site globally.</p>
                          </div>
                        </div>
                        <div className="space-y-4 pt-2">
                           {Object.keys(SYSTEM_GLOSSARY).map(key => {
                              const originalVal = SYSTEM_GLOSSARY[key];
                              const currentVal = lexiconOverrides[key]?.en || originalVal.en;
                              return (
                                <div key={key} className="space-y-1">
                                  <label className="block text-xs font-bold text-slate-700 tracking-wide break-all">{key}</label>
                                  <input 
                                    type="text"
                                    value={currentVal}
                                    onChange={e => setLexiconOverride(key, 'en', e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                                  />
                                </div>
                              );
                           })}
                        </div>
                      </div>
                    )}"""
                    
    content = content.replace(form_target, "")

    with open('src/components/platform/SystemCommandCenter.tsx', 'w') as f:
        f.write(content)

patch()
