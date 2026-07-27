const fs = require('fs');
const file = 'src/components/intelligence/IntelligenceCenter.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import \{ useLedgerStore \} from '\.\.\/\.\.\/stores\/useLedgerStore';\nimport \{ useUIStore \} from '\.\.\/\.\.\/stores\/useUIStore';\nimport \{ useCommandDispatcher \} from '\.\.\/\.\.\/hooks\/useSystemContext';\nimport \{ useAuditTelemetry \} from '\.\.\/\.\.\/hooks\/useAuditTelemetry';\n\nexport default function AnalyticalCenter\(\) \{/, 'export default function AnalyticalCenter() {');

fs.writeFileSync(file, content);
