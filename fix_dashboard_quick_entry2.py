import re

with open('src/components/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

if 'useUIStore' not in content:
    content = content.replace("import { useAuthStore } from '../stores/useAuthStore';", "import { useAuthStore } from '../stores/useAuthStore';\nimport { useUIStore } from '../stores/useUIStore';")

# Remove local fastInput state
content = re.sub(r"const \[fastInput, setFastInput\] = useState\(''\);\n\s*const \[isProcessing, setIsProcessing\] = useState\(false\);\n", "", content)

# Remove handleExecute function completely
start_handle = content.find("const handleExecute = async () => {")
if start_handle != -1:
    brace_count = 0
    end_handle = -1
    for i in range(start_handle, len(content)):
        if content[i] == '{':
            brace_count += 1
        elif content[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                end_handle = i + 1
                break
    
    if end_handle != -1:
        content = content[:start_handle] + content[end_handle:]

ui_target = """      {/* Main Command Bar */}
      <div className="relative group">
         <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
           <Zap className="text-indigo-600 group-focus-within:text-indigo-500 transition-colors" size={24} />
         </div>
         <input 
           type="text"
           value={fastInput}
           onChange={e => setFastInput(e.target.value)}
           onKeyDown={e => e.key === 'Enter' && handleExecute()}
           placeholder="Fast Entry: Type 'Spent $50 on lunches' or 'Received $500'"
           className="w-full bg-white border border-slate-200 rounded-[32px] py-4 md:py-6 pl-12 md:pl-16 pr-28 md:pr-32 text-base md:text-xl font-bold text-slate-900 shadow-sm focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition-all placeholder:text-slate-300 placeholder:text-sm md:placeholder:text-base placeholder:truncate"
         />
         <div className="absolute inset-y-0 right-4 flex items-center">
            <button 
              onClick={handleExecute}
              disabled={isProcessing || !fastInput.trim()}
              className="px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-medium tracking-wide transition-all uppercase text-xs flex items-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Execute'}
            </button>
         </div>
      </div>"""

ui_replacement = """      {/* Main Command Bar */}
      <div className="relative group cursor-pointer" onClick={() => useUIStore.getState().setQuickEntryOpen(true)}>
         <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
           <Zap className="text-indigo-600 transition-colors" size={24} />
         </div>
         <div className="w-full bg-white border border-slate-200 hover:border-indigo-300 rounded-[32px] py-4 md:py-6 pl-12 md:pl-16 pr-28 md:pr-32 text-left text-base md:text-xl font-bold text-slate-300 shadow-sm transition-all flex items-center">
            <span className="truncate">Fast Entry: Type 'Spent $50 on lunches'...</span>
         </div>
         <div className="absolute inset-y-0 right-4 flex items-center">
            <button className="px-6 py-3 bg-slate-900 text-white rounded-xl font-medium tracking-wide transition-all uppercase text-xs flex items-center gap-2 group-hover:bg-black">
              Execute
            </button>
         </div>
      </div>"""

content = content.replace(ui_target, ui_replacement)

# What about the Quick Actions? Are they functional or dummy?
qa_target = """      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <button className="p-4 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-indigo-700 font-medium">
          <div className="p-2 bg-white rounded-full shadow-sm"><DollarSign size={18} className="text-indigo-600" /></div>
          Create Invoice
        </button>
        <button className="p-4 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-emerald-700 font-medium">
          <div className="p-2 bg-white rounded-full shadow-sm"><ArrowUpRight size={18} className="text-emerald-600" /></div>
          Record Receipt
        </button>
        <button className="p-4 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-rose-700 font-medium">
          <div className="p-2 bg-white rounded-full shadow-sm"><ArrowDownRight size={18} className="text-rose-600" /></div>
          Log Expense
        </button>
        <button className="p-4 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-amber-700 font-medium">
          <div className="p-2 bg-white rounded-full shadow-sm"><Database size={18} className="text-amber-600" /></div>
          Upload CSV
        </button>
      </div>"""

qa_replacement = """      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <button onClick={() => useUIStore.getState().setActiveTab('sales')} className="p-4 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-indigo-700 font-medium cursor-pointer">
          <div className="p-2 bg-white rounded-full shadow-sm"><DollarSign size={18} className="text-indigo-600" /></div>
          Create Invoice
        </button>
        <button onClick={() => useUIStore.getState().setQuickEntryOpen(true)} className="p-4 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-emerald-700 font-medium cursor-pointer">
          <div className="p-2 bg-white rounded-full shadow-sm"><ArrowUpRight size={18} className="text-emerald-600" /></div>
          Record Receipt
        </button>
        <button onClick={() => useUIStore.getState().setQuickEntryOpen(true)} className="p-4 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-rose-700 font-medium cursor-pointer">
          <div className="p-2 bg-white rounded-full shadow-sm"><ArrowDownRight size={18} className="text-rose-600" /></div>
          Log Expense
        </button>
        <button onClick={() => useUIStore.getState().setImporterOpen(true)} className="p-4 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-amber-700 font-medium cursor-pointer">
          <div className="p-2 bg-white rounded-full shadow-sm"><Database size={18} className="text-amber-600" /></div>
          Upload CSV
        </button>
      </div>"""

content = content.replace(qa_target, qa_replacement)

with open('src/components/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
