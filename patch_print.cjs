const fs = require('fs');
const file = 'src/lib/printInvoice.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const amountDue = invoice.totalCents - (invoice.amountPaidCents || 0);",
  "const amountDue = (invoice.totalCents || invoice.amountCents || 0) - ((invoice.metadata && invoice.metadata.amountPaidCents) || 0);"
);

content = content.replace(
  "const statusColor = invoice.status === 'paid' ? 'green' : invoice.status === 'void' ? 'red' : 'orange';",
  "const statusColor = invoice.status === 'paid' ? 'green' : invoice.status === 'rejected' ? 'red' : 'orange';"
);

content = content.replace(
  "invoice.amountPaidCents ?",
  "(invoice.metadata && invoice.metadata.amountPaidCents) ?"
);

content = content.replace(
  "invoice.amountPaidCents",
  "(invoice.metadata && invoice.metadata.amountPaidCents)"
);

content = content.replace(
  "invoice.amountPaidCents",
  "(invoice.metadata && invoice.metadata.amountPaidCents)"
);

content = content.replace(
  "invoice.notes",
  "(invoice.metadata && invoice.metadata.notes)"
);

content = content.replace(
  "invoice.notes",
  "(invoice.metadata && invoice.metadata.notes)"
);

content = content.replace(
  "(invoice.lines || [])",
  "((invoice.metadata && invoice.metadata.lines) || [])"
);

content = content.replace(
  "invoice.totalCents",
  "(invoice.totalCents || invoice.amountCents || 0)"
);

fs.writeFileSync(file, content);
console.log("Patched printInvoice");
