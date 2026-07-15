const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const oldLogic = `      let dayRev = 0;
      let dayExp = 0;
      dayTxs.forEach(tx => {
        if (tx.lines.some(l => {
          const acc = accounts.find(a => a.id === l.accountId);
          return acc && acc.type === 'income';
        })) {
          dayRev += tx.totalAmountCents;
        } else if (tx.lines.some(l => {
          const acc = accounts.find(a => a.id === l.accountId);
          return acc && acc.type === 'expense';
        })) {
          dayExp += tx.totalAmountCents;
        }
      });`;

const newLogic = `      let dayRev = 0;
      let dayExp = 0;
      dayTxs.forEach(tx => {
        tx.lines.forEach(l => {
          const acc = accounts.find(a => a.id === l.accountId);
          if (acc) {
            if (acc.type === 'income') {
              dayRev += Math.abs(l.amountCents);
            } else if (acc.type === 'expense') {
              dayExp += Math.abs(l.amountCents);
            }
          }
        });
      });`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log("Fixed dashboard chart logic");
