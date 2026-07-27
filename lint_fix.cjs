const fs = require('fs');

// Fix Inventory.tsx
let inv = fs.readFileSync('src/components/inventory/Inventory.tsx', 'utf8');
const invImports = `import { useAuthStore } from '../../stores/useAuthStore';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';
import { StrategicEngine } from '../../modules/intelligence/StrategicEngine';\n`;
if (!inv.includes('import { useAuthStore }')) {
    inv = invImports + inv;
} else if (!inv.includes('import { toast }')) {
    inv = inv.replace(/import \{ useAuthStore \} from '\.\.\/\.\.\/stores\/useAuthStore';/, invImports);
}
fs.writeFileSync('src/components/inventory/Inventory.tsx', inv);

// Fix Ledger.tsx
let ledg = fs.readFileSync('src/components/ledger/Ledger.tsx', 'utf8');
ledg = ledg.replace(/account: accounts\.find\(a => a\.id === id\)\?\.name/g, 'account: accounts.find(a => a.id === id)?.name || ""');
ledg = ledg.replace(/user: user \|\| \{\} as any,/g, 'user: user as any,');
fs.writeFileSync('src/components/ledger/Ledger.tsx', ledg);

