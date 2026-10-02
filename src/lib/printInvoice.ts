import { Invoice, Customer } from '../types';
import { formatCurrency } from './utils';

export function printInvoice(invoice: Invoice, customer?: Customer, workspaceName: string = 'My Company') {
  const amountDue = (invoice.amountCents || 0) - ((invoice.metadata && invoice.metadata.amountPaidCents) || invoice.amountPaidCents || 0);
  const statusColor = invoice.status === 'paid' ? 'green' : invoice.status === 'rejected' ? 'red' : 'orange';
  
  const html = `
    <html>
    <head>
      <title>Invoice ${invoice.number}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 20px; }
        .header-left h1 { margin: 0; font-size: 32px; color: #111; }
        .header-right { text-align: right; }
        .header-right h2 { margin: 0; font-size: 24px; color: #555; }
        .info-section { display: flex; justify-content: space-between; margin-top: 40px; }
        .bill-to h3 { margin-top: 0; color: #666; font-size: 14px; text-transform: uppercase; }
        .meta-table { border-collapse: collapse; }
        .meta-table td { padding: 5px 15px; text-align: right; }
        .meta-table td:first-child { font-weight: bold; color: #666; text-align: left; }
        .items-table { width: 100%; border-collapse: collapse; margin-top: 40px; }
        .items-table th { background: #f9f9f9; padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .items-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .items-table th.right, .items-table td.right { text-align: right; }
        .totals-section { margin-top: 40px; display: flex; justify-content: flex-end; }
        .totals-table { width: 300px; border-collapse: collapse; }
        .totals-table td { padding: 10px; text-align: right; border-bottom: 1px solid #eee; }
        .totals-table td:first-child { font-weight: bold; text-align: left; }
        .totals-table .total-row { font-size: 18px; font-weight: bold; border-top: 2px solid #333; border-bottom: none; }
        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; text-transform: uppercase; border: 1px solid currentColor; color: ${statusColor}; margin-top: 10px; }
        .notes { margin-top: 40px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <h1>${workspaceName}</h1>
        </div>
        <div class="header-right">
          <h2>INVOICE</h2>
          <div># ${invoice.number}</div>
          <div class="status-badge">${invoice.status}</div>
        </div>
      </div>
      
      <div class="info-section">
        <div class="bill-to">
          <h3>Bill To</h3>
          <strong>${customer?.name || 'Unknown Customer'}</strong><br/>
          ${customer?.email ? customer.email + '<br/>' : ''}
          ${customer?.phone ? customer.phone + '<br/>' : ''}
        </div>
        <div>
          <table class="meta-table">
            <tr><td>Date:</td><td>${invoice.date}</td></tr>
            <tr><td>Due Date:</td><td>${invoice.dueDate || invoice.date}</td></tr>
          </table>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th class="right">Qty</th>
            <th class="right">Rate</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${((invoice.metadata && invoice.metadata.lines) || []).map((item: any) => `
            <tr>
              <td>${item.description || 'Item'}</td>
              <td class="right">${item.quantity || 1}</td>
              <td class="right">${formatCurrency(item.rateCents ?? item.amountCents ?? 0)}</td>
              <td class="right">${formatCurrency(item.amountCents)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals-section">
        <table class="totals-table">
          <tr><td>Subtotal</td><td>${formatCurrency(invoice.amountCents)}</td></tr>
          ${(invoice.metadata && invoice.metadata.amountPaidCents) ? `<tr><td>Amount Paid</td><td>-${formatCurrency((invoice.metadata && invoice.metadata.amountPaidCents))}</td></tr>` : ''}
          <tr class="total-row"><td>Amount Due</td><td>${formatCurrency(amountDue)}</td></tr>
        </table>
      </div>

      ${(invoice.metadata && invoice.metadata.notes) ? `<div class="notes"><strong>Notes:</strong><br/>${(invoice.metadata && invoice.metadata.notes)}</div>` : ''}
      
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `;
  
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
