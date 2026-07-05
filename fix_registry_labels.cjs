const fs = require('fs');
let content = fs.readFileSync('src/config/registry.tsx', 'utf8');

const replacements = [
  { search: /'Process Automation'/g, replace: "'Automations'" },
  { search: /'Document Vault'/g, replace: "'Documents'" },
  { search: /'Advanced Audit Trail'/g, replace: "'Audit Trail'" },
  { search: /'System Audits'/g, replace: "'Security'" },
  { search: /'Data Importer'/g, replace: "'Import Data'" },
  { search: /'System Settings'/g, replace: "'Settings'" },
];

for (const r of replacements) {
  content = content.replace(r.search, r.replace);
}

fs.writeFileSync('src/config/registry.tsx', content);
console.log("Fixed registry labels");
