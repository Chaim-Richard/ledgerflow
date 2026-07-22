const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const isComponent = file => file.endsWith('.tsx') && !file.includes('Dashboard.tsx');

walkDir('./src/components', (filePath) => {
  if (!isComponent(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // We want to transform:
  // 1. Primary card backgrounds: bg-[var(--surface)] -> bg-[var(--panel)]
  // 2. Card borders: border-[var(--line)]/80 or border-[var(--line)]/85 -> border-[var(--line)]
  // 3. Card rounding: rounded-xl -> rounded-2xl, rounded-[32px] -> rounded-2xl, rounded-[40px] -> rounded-2xl
  // 4. Card shadows: shadow-3xs or shadow-xs -> shadow-sm
  
  // But ONLY for elements that look like cards. Let's do some targeted regex.
  // Actually, we can just replace specific strings that are common for main containers.
  
  // For full page wrappers or main table wrappers:
  content = content.replace(/bg-\[var\(--surface\)\]\s+(.*?border.*?)\s+rounded-xl/g, 'bg-[var(--panel)] $1 rounded-2xl');
  content = content.replace(/bg-\[var\(--surface\)\]\s+rounded-xl\s+(.*?border.*?)(\s+|$)/g, 'bg-[var(--panel)] rounded-2xl $1$2');
  content = content.replace(/bg-\[var\(--surface\)\]\s+(.*?)\s+rounded-xl\s+(.*?border.*?)(\s+|$)/g, 'bg-[var(--panel)] $1 rounded-2xl $2$3');
  
  // Clean up fractional borders on lines
  content = content.replace(/border-\[var\(--line\)\]\/(80|85|70|50)/g, 'border-[var(--line)]');
  
  // Clean up weird shadows
  content = content.replace(/shadow-3xs/g, 'shadow-sm');
  content = content.replace(/shadow-xs/g, 'shadow-sm');
  
  // Make large border radii match dashboard
  content = content.replace(/rounded-\[40px\]/g, 'rounded-2xl');
  content = content.replace(/rounded-\[32px\]/g, 'rounded-xl'); // xl for inner elements, as 2xl is 16px, 3xl is 24px

  // Also replace any bg-zinc-100 or bg-white that is used as a card
  content = content.replace(/bg-zinc-100/g, 'bg-[var(--surface)]');
  content = content.replace(/bg-white/g, 'bg-[var(--panel)]');
  
  // Fix text-zinc-600 or slate to use variables
  content = content.replace(/text-slate-500/g, 'text-[var(--muted)]');
  content = content.replace(/text-slate-400/g, 'text-[var(--faint)]');
  content = content.replace(/text-zinc-500/g, 'text-[var(--muted)]');
  content = content.replace(/text-zinc-600/g, 'text-[var(--text)]');
  content = content.replace(/text-zinc-400/g, 'text-[var(--faint)]');
  content = content.replace(/text-zinc-900/g, 'text-[var(--ink)]');
  content = content.replace(/bg-zinc-900/g, 'bg-[var(--ink)]');

  // Change bg-slate-900 to ink
  content = content.replace(/bg-slate-900/g, 'bg-[var(--ink)]');
  content = content.replace(/text-white/g, 'text-[var(--panel)]'); // Be careful with text-white

  // Specific to JournalView / PivotView style tables
  content = content.replace(/className="flex-1 min-h-0 bg-\[var\(--surface\)\] relative z-10/g, 'className="flex-1 min-h-0 bg-[var(--panel)] relative z-10');
  content = content.replace(/className="flex flex-col h-full bg-\[var\(--surface\)\]/g, 'className="flex flex-col h-full bg-[var(--panel)]');
  content = content.replace(/className="flex-1 overflow-auto bg-\[var\(--surface\)\]/g, 'className="flex-1 overflow-auto bg-[var(--panel)]');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated', filePath);
  }
});
