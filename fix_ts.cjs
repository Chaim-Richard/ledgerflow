const fs = require('fs');
let c = fs.readFileSync('src/components/platform/settings/AISettings.tsx', 'utf8');
c = c.replace(
  `      if (typeof currentWorkspace.matchingThreshold === 'number') {
        setTimeout(() => setThreshold(currentWorkspace.matchingThreshold), 0);
      }`,
  `      if (typeof currentWorkspace.matchingThreshold === 'number') {
        const t = currentWorkspace.matchingThreshold;
        setTimeout(() => setThreshold(t), 0);
      }`
);
fs.writeFileSync('src/components/platform/settings/AISettings.tsx', c);
