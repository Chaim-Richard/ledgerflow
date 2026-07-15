import re

with open('src/components/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add useUIStore import if not there
if 'useUIStore' not in content:
    content = content.replace("import { useAuthStore }", "import { useAuthStore }\nimport { useUIStore }")

# Remove local fastInput state
content = re.sub(r"const \[fastInput, setFastInput\] = useState\(''\);\n\s*const \[isProcessing, setIsProcessing\] = useState\(false\);\n", "", content)

# Remove handleExecute function completely
start_handle = content.find("const handleExecute = async () => {")
if start_handle != -1:
    # Find matching closing brace
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

# Now find the UI part that renders the fast input
ui_target = """         <input 
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
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white p-2 md:p-3 rounded-2xl md:rounded-[24px] shadow-sm transition-all"
            >
              {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <ArrowUpRight size={24} />}
            </button>
         </div>"""

# Replace it with a button that looks like an input and opens Magic Entry
ui_replacement = """         <button 
           type="button"
           onClick={() => useUIStore.getState().setQuickEntryOpen(true)}
           className="w-full bg-white border border-slate-200 hover:border-indigo-300 rounded-[32px] py-4 md:py-6 pl-12 md:pl-16 pr-28 md:pr-32 text-left text-base md:text-xl font-bold text-slate-300 shadow-sm transition-all group flex items-center justify-between"
         >
           <span className="truncate">Fast Entry: Type 'Spent $50 on lunches'...</span>
           <div className="bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 p-2 md:p-3 rounded-2xl md:rounded-[24px] shadow-sm transition-all absolute right-4">
              <Zap size={24} className="fill-indigo-600/20" />
           </div>
         </button>"""

# Using regex to replace because whitespace might not match perfectly
# Let's just find `<div className="relative max-w-4xl mx-auto mb-8 md:mb-12">`
# and replace the content inside it.

wrapper_start = content.find('<div className="relative max-w-4xl mx-auto mb-8 md:mb-12">')
if wrapper_start != -1:
    wrapper_end = content.find('</div>', wrapper_start + 100) + 6
    old_wrapper = content[wrapper_start:wrapper_end]
    
    new_wrapper = """      <div className="relative max-w-4xl mx-auto mb-8 md:mb-12">
         <div className="absolute inset-y-0 left-5 md:left-6 flex items-center pointer-events-none">
            <Zap className="h-5 w-5 md:h-6 md:w-6 text-indigo-500 fill-indigo-500/20" />
         </div>
""" + ui_replacement + """
      </div>"""
    
    content = content.replace(old_wrapper, new_wrapper)
else:
    print("Wrapper not found!")

with open('src/components/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

