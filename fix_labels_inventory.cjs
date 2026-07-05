const fs = require('fs');

function replaceInFile(path, replacements) {
  try {
    let content = fs.readFileSync(path, 'utf8');
    for (const r of replacements) {
      content = content.replace(r.search, r.replace);
    }
    fs.writeFileSync(path, content);
  } catch (e) {}
}

replaceInFile('src/components/inventory/Inventory.tsx', [
  { search: /Elastic Supply Simulation: Active/g, replace: 'Real-time stock management.' },
  { search: /<span className="text-2xl font-mono opacity-20 uppercase tracking-widest truncate">Nodes<\/span>/g, replace: '' }
]);

console.log("Fixed labels inventory");
