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

replaceInFile('src/config/registry.tsx', [
  { search: /pulse: { en: 'Pulse', he: 'ראשי' }/g, replace: "pulse: { en: 'Dashboard', he: 'ראשי' }" },
  { search: /finance: { en: 'Financial Architecture', he: 'ליבה פיננסית' }/g, replace: "finance: { en: 'Accounting', he: 'הנהלת חשבונות' }" },
  { search: /operations: { en: 'Operations', he: 'תפעול' }/g, replace: "operations: { en: 'Business', he: 'עסקים' }" },
  { search: /strategy: { en: 'Strategy & Growth', he: 'אסטרטגיה' }/g, replace: "strategy: { en: 'Intelligence', he: 'בינה' }" },
  { search: /planning: { en: 'Planning & Tax', he: 'תכנון ומיסים' }/g, replace: "planning: { en: 'Planning', he: 'תכנון' }" },
  { search: /system: { en: 'System & Vault', he: 'מערכת' }/g, replace: "system: { en: 'Settings', he: 'הגדרות' }" }
]);

console.log("Fixed nav groups");
