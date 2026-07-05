const fs = require('fs');

['src/components/Dashboard.tsx', 'src/components/layout/Header.tsx', 'src/components/layout/Sidebar.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/text-\[10px\]/g, 'text-xs');
  content = content.replace(/text-\[9px\]/g, 'text-sm');
  content = content.replace(/text-\[8px\]/g, 'text-xs');
  content = content.replace(/uppercase/g, '');
  content = content.replace(/tracking-widest/g, 'tracking-normal');
  content = content.replace(/tracking-wider/g, 'tracking-normal');
  content = content.replace(/font-black/g, 'font-semibold');

  fs.writeFileSync(file, content);
});

console.log("Replaced tailwind classes everywhere");
