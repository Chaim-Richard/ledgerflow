const fs = require('fs');
const path = require('path');
let dPath = path.join(__dirname, 'src/components/Dashboard.tsx');
if (fs.existsSync(dPath)) {
  let d = fs.readFileSync(dPath, 'utf8');
  d = d.replace(/acc\.type === 'income'/g, `(acc.type === 'income' || acc.type === 'revenue')`);
  d = d.replace(/acc\.type === 'expense'/g, `(acc.type === 'expense' || acc.type === 'cost_of_goods')`);
  fs.writeFileSync(dPath, d);
}
let cPath = path.join(__dirname, 'src/hooks/useFinancialReporting.ts');
if (fs.existsSync(cPath)) {
  let c = fs.readFileSync(cPath, 'utf8');
  c = c.replace(/acc\.type === 'income'/g, `(acc.type === 'income' || acc.type === 'revenue')`);
  c = c.replace(/acc\.type === 'expense'/g, `(acc.type === 'expense' || acc.type === 'cost_of_goods')`);
  fs.writeFileSync(cPath, c);
}
let aPath = path.join(__dirname, 'src/hooks/useAuditTelemetry.ts');
if (fs.existsSync(aPath)) {
  let a = fs.readFileSync(aPath, 'utf8');
  a = a.replace(/acc\.type === 'income'/g, `(acc.type === 'income' || acc.type === 'revenue')`);
  a = a.replace(/acc\.type === 'expense'/g, `(acc.type === 'expense' || acc.type === 'cost_of_goods')`);
  fs.writeFileSync(aPath, a);
}
