const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import \{ useSystemProps, useCommandDispatcher \} from '\.\/hooks\/useSystemContext';/, 'import { useCommandDispatcher } from \'./hooks/useSystemContext\';');
content = content.replace(/const coreSystemProps = useSystemProps\(handleAction\);\n/, '');
content = content.replace(/coreSystemProps=\{coreSystemProps\}\n/, '');

fs.writeFileSync(file, content);
