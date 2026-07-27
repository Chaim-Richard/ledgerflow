const fs = require('fs');
const file = 'src/components/layout/MainViewSwitcher.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove useSystemProps entirely
content = content.replace(/const props = useSystemProps\(handleAction\);\n/g, '');
content = content.replace(/import { useSystemProps, useCommandDispatcher } from '\.\.\/\.\.\/hooks\/useSystemContext';/g, 'import { useCommandDispatcher } from \'../../hooks/useSystemContext\';');
content = content.replace(/<Component \{\.\.\.props\} \/>/g, '<Component />');

fs.writeFileSync(file, content);
