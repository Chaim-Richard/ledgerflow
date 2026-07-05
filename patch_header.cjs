const fs = require('fs');
let content = fs.readFileSync('src/components/layout/Header.tsx', 'utf8');

if (!content.includes('QuickCreateMenu')) {
  content = content.replace("import { Menu, Search, Briefcase, Plus } from 'lucide-react';", "import { Menu, Search, Briefcase, Plus } from 'lucide-react';\nimport QuickCreateMenu from './QuickCreateMenu';");
  
  const target = `<button 
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden md:flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus size={16} />
          <span className="hidden lg:inline">Quick Create</span>
          <span className="lg:hidden">New</span>
        </button>`;
        
  if (content.includes(target)) {
    content = content.replace(target, `<QuickCreateMenu />`);
    fs.writeFileSync('src/components/layout/Header.tsx', content);
    console.log("Patched Header");
  } else {
    console.log("Could not find target in Header");
  }
}
