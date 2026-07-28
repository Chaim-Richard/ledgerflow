const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Fix ts(18046): err is unknown
code = code.replace(/} catch \(err\) {/g, '} catch (err: any) {');

// Fix ts(18048): inv is possibly undefined
code = code.replace(/if \(inv\.status !== 'paid'\)/g, 'if (inv && inv.status !== "paid")');
code = code.replace(/Invoice \${inv\.number}/g, 'Invoice ${inv?.number || "Unknown"}');
code = code.replace(/currency: inv\.currency/g, 'currency: inv?.currency');

// Fix ts(2339): Property 'subtype' does not exist on type '{ id: string; }'
code = code.replace(/let cashAccount = accounts\.find\(a => a\.subtype === 'cash'/g, 'let cashAccount: any = accounts.find((a: any) => a.subtype === "cash"');
code = code.replace(/let arAccount = accounts\.find\(a => a\.subtype === 'accounts_receivable'/g, 'let arAccount: any = accounts.find((a: any) => a.subtype === "accounts_receivable"');

fs.writeFileSync('server.ts', code);
