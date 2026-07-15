const fs = require('fs');

let cpCode = fs.readFileSync('./src/components/layout/CommandPalette.tsx', 'utf8');
cpCode = cpCode.replace(/let results = \[\];/g, 'let results: any[] = [];');
cpCode = cpCode.replace(/const results = \[\];/g, 'const results: any[] = [];');
cpCode = cpCode.replace(/match\(c\.group\)/g, 'match((c as any).group)');
cpCode = cpCode.replace(/match\(v\.group\)/g, 'match((v as any).group)');
cpCode = cpCode.replace(/c\.group \?/g, '(c as any).group ?');
cpCode = cpCode.replace(/c\.group :/g, '(c as any).group :');
cpCode = cpCode.replace(/v\.group \?/g, '(v as any).group ?');
cpCode = cpCode.replace(/v\.group :/g, '(v as any).group :');
fs.writeFileSync('./src/components/layout/CommandPalette.tsx', cpCode);

