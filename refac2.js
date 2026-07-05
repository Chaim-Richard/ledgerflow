const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

content = content.replace(/text-\[10px\]/g, 'text-xs');
content = content.replace(/uppercase/g, '');
content = content.replace(/tracking-widest/g, 'tracking-normal');
content = content.replace(/tracking-wider/g, 'tracking-wide');
content = content.replace(/font-black/g, 'font-bold');

fs.writeFileSync('src/components/Dashboard.tsx', content);

let cssContent = fs.readFileSync('src/index.css', 'utf8');
cssContent = cssContent.replace(/#0a0a0b/g, '#F8FAFC'); 
// wait, I already replaced the CSS content via the edit_file tool, index.css is fine.

console.log("Replaced tailwind classes in Dashboard.tsx");
