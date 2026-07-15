import sys

def patch():
    with open('src/components/platform/SystemCommandCenter.tsx', 'r') as f:
        content = f.read()

    state_target = "const [activeMainTab, setActiveMainTab] = useState<'workspaces' | 'users' | 'global'>('workspaces');"
    state_replacement = "const [activeMainTab, setActiveMainTab] = useState<'workspaces' | 'users' | 'global' | 'lexicon'>('workspaces');"
    if state_target in content:
        content = content.replace(state_target, state_replacement)

    buttons_target = """            <button
              onClick={() => setActiveMainTab('users')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeMainTab === 'users' ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
              )}
            >
              <Users className="inline-block w-3.5 h-3.5 mr-2 -mt-0.5" />
              Deep User Matrix
            </button>
          </div>"""
    
    buttons_replacement = """            <button
              onClick={() => setActiveMainTab('users')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeMainTab === 'users' ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
              )}
            >
              <Users className="inline-block w-3.5 h-3.5 mr-2 -mt-0.5" />
              Deep User Matrix
            </button>
            <button
              onClick={() => setActiveMainTab('lexicon')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeMainTab === 'lexicon' ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
              )}
            >
              <BookA className="inline-block w-3.5 h-3.5 mr-2 -mt-0.5" />
              Site Lexicon Control
            </button>
          </div>"""

    if buttons_target in content:
        content = content.replace(buttons_target, buttons_replacement)
    else:
        print("Buttons target not found")

    # Add Lexicon content block
    content_target = """          {activeMainTab === 'users' ? ("""
    
    content_replacement = """          {activeMainTab === 'lexicon' ? (
            <div className="space-y-8">
              <div className="bg-white border border-slate-200 rounded-[32px] shadow-3xs overflow-hidden">
                <div className="p-4 md:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-3">
                    <BookA size={16} className="text-[#0047AB]" />
                    <h3 className="text-[12px] font-black uppercase tracking-widest text-slate-800">Global Lexicon Override</h3>
                  </div>
                </div>
                <div className="p-6 md:p-8 space-y-6">
                  <p className="text-sm text-slate-500">
                    Use this administrative panel to override any hardcoded text across the system. This allows full white-labeling and customization of the site's terminology. Changes here are applied instantly for all users.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.keys(SYSTEM_GLOSSARY).map(key => {
                        const originalVal = SYSTEM_GLOSSARY[key];
                        const currentVal = lexiconOverrides[key]?.en || originalVal.en;
                        return (
                          <div key={key} className="space-y-2 p-4 bg-slate-50 rounded-[20px] border border-slate-200">
                            <label className="block text-xs font-bold text-slate-700 tracking-wide break-all">{key}</label>
                            <input 
                              type="text"
                              value={currentVal}
                              onChange={e => setLexiconOverride(key, 'en', e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 transition-all"
                            />
                          </div>
                        );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : activeMainTab === 'users' ? ("""

    if content_target in content:
        content = content.replace(content_target, content_replacement)
    else:
        print("Content target not found")

    with open('src/components/platform/SystemCommandCenter.tsx', 'w') as f:
        f.write(content)

patch()
