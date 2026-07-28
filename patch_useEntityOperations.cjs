const fs = require('fs');
let code = fs.readFileSync('src/hooks/useEntityOperations.ts', 'utf8');

const sendInvoiceCode = `
      if (path === 'invoices' && finalData.status === 'sent') {
        fetch(\`/api/v1/invoices/\${docId || id}/send\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: currentWorkspaceId,
            toEmail: finalData.metadata?.sentTo || 'customer@example.com',
            subject: finalData.metadata?.emailSubject || \`Invoice \${finalData.number}\`,
            body: finalData.metadata?.emailBody || 'Please find your invoice attached.'
          })
        }).then(res => res.json()).then(data => {
          if (data.success) {
            toast.success('Invoice email sent successfully.');
            // Copy to clipboard for easy testing
            if (data.invoiceUrl) {
              navigator.clipboard.writeText(data.invoiceUrl);
              toast.info('Payment link copied to clipboard: ' + data.invoiceUrl);
            }
          } else {
            toast.error(data.error || 'Failed to send invoice email.');
          }
        }).catch(err => {
          console.error('Failed to send invoice email:', err);
          toast.error('Failed to send invoice email.');
        });
      }
`;

// Insert into addEntity
code = code.replace(
  `      if (path === 'invoices') {`,
  `      if (path === 'invoices') {
        ${sendInvoiceCode.replace(/id/g, 'docId')}
`
);

// Insert into updateEntity
code = code.replace(
  `      // Post to ledger if it's an invoice or a bill`,
  `      // Post to ledger if it's an invoice or a bill
        ${sendInvoiceCode}
`
);

fs.writeFileSync('src/hooks/useEntityOperations.ts', code);
