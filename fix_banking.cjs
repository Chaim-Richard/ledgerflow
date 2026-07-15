const fs = require('fs');
let content = fs.readFileSync('src/components/finance/BankingHub.tsx', 'utf8');

content = content.replace(
  '<div key={idx} className="truncate">• {t.date} : {$(((t as any).amountCents / 100).toFixed(2))}</div>',
  '<div key={idx} className="truncate">• {t.date} : ${((t as any).amountCents / 100).toFixed(2)}</div>'
);

fs.writeFileSync('src/components/finance/BankingHub.tsx', content);
