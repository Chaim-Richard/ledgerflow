const fs = require('fs');
let content = fs.readFileSync('src/components/layout/ShortcutOverlay.tsx', 'utf8');

const target = `const shortcuts: any[] = [];`;
const replaceWith = `const shortcuts = [
    { key: '⌘ + K', desc: 'Global Command Palette', icon: Search },
    { key: '⌘ + /', desc: 'Show Keyboard Shortcuts', icon: Command },
    { key: 'Esc', desc: 'Close Modals & Drawers', icon: X },
    { key: '?', desc: 'Toggle Intelligence UI', icon: Activity },
    { key: 'Shift + N', desc: 'Quick Create (Transaction)', icon: Plus },
    { key: 'Shift + S', desc: 'Quick Create (Invoice/Sales)', icon: Plus },
    { key: 'Shift + B', desc: 'Quick Create (Bill)', icon: Plus },
  ];`;

content = content.replace(target, replaceWith);

const renderTarget = `                </button>
              </div>
            </div>`;

if (!content.includes('grid grid-cols-1 md:grid-cols-2')) {
  const mapTarget = `            <div className="p-4 md:p-10 border-b border-slate-200 bg-slate-50/30">`;
  const replaceRender = `
            <div className="p-4 md:p-10 border-b border-slate-200 bg-slate-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                {shortcuts.map((sc, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><sc.icon size={16} /></div>
                      <span className="font-bold text-slate-700 text-sm">{sc.desc}</span>
                    </div>
                    <kbd className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-mono font-bold rounded">{sc.key}</kbd>
                  </div>
                ))}
              </div>`;
  content = content.replace(`            <div className="p-4 md:p-10 border-b border-slate-200 bg-slate-50/30">`, replaceRender);
}

fs.writeFileSync('src/components/layout/ShortcutOverlay.tsx', content);
console.log('Fixed shortcuts overlay');
