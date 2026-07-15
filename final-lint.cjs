const fs = require('fs');

// Patch IntelligenceCenter.tsx
let icCode = fs.readFileSync('./src/components/intelligence/IntelligenceCenter.tsx', 'utf8');
icCode = icCode.replace(/const Component = INTELLIGENCE_COMPONENTS\[activeTabDef\.componentName\];/g, 
  'const Component = INTELLIGENCE_COMPONENTS[(activeTabDef as any).componentName];');
fs.writeFileSync('./src/components/intelligence/IntelligenceCenter.tsx', icCode);

// Patch CommandPalette.tsx
let cpCode = fs.readFileSync('./src/components/layout/CommandPalette.tsx', 'utf8');
cpCode = cpCode.replace(/match\(/g, 'match((');
cpCode = cpCode.replace(/match\(\(c\.email\)/g, 'match(((c as any).email)');
cpCode = cpCode.replace(/match\(\(v\.email\)/g, 'match(((v as any).email)');
// actually this regex is messy, let's just do it directly.
