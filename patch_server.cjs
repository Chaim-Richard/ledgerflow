const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Quick fixes for the server TS errors using 'as any' since it's just webhook data
code = code.replace(/const inv = doc.data\(\);/g, 'const inv = doc.data() as any;');
code = code.replace(/const inv = doc\.data\(\) \|\| \{\};/g, 'const inv = doc.data() as any || {};');

code = code.replace(/let cashAccount: any = accounts.find\(\(a: any\) => a.subtype === "cash"/g, 'let cashAccount: any = accounts.find((a: any) => a.subtype === "cash"');
code = code.replace(/if \(!cashAccount\) cashAccount = \{ id: 'unknown_cash', name: 'Stripe Clearing' \};/g, 'if (!cashAccount) cashAccount = { id: "unknown_cash", name: "Stripe Clearing" } as any;');
code = code.replace(/if \(!arAccount\) arAccount = \{ id: 'unknown_ar', name: 'Accounts Receivable' \};/g, 'if (!arAccount) arAccount = { id: "unknown_ar", name: "Accounts Receivable" } as any;');

fs.writeFileSync('server.ts', code);
