import re

with open('src/services/LedgerPostService.ts', 'r') as f:
    content = f.read()

# Fix dead code 'if (true) {'
content = content.replace('if (true) {', 'if (txsToPost.length > 0) {')

invoice_accrual_old = """    // 2. Transaction 1: Accrual Posting (DR A/R, CR Revenue)
    const accrualTx = {
      uid,
      workspaceId,
      date: invoiceDate,
      description: `Invoice ${invoiceNum} - ${customer}`,
      totalAmountCents: amount,
      currency: invoiceData.currency || 'USD',
      exchangeRate: rate,
      status: 'completed',
      type: 'actual',
      createdAt: new Date().toISOString(),
      metadata: {
        invoiceId,
        type: 'invoice-accrual'
      },
      lines: [
        {
          accountId: arAccount.id,
          accountName: arAccount.name,
          amountCents: amount, // Debit (positive)
          description: `Accounts Receivable posting for Invoice ${invoiceNum}`,
          exchangeRate: rate
        },
        {
          accountId: revenueAccount.id,
          accountName: revenueAccount.name,
          amountCents: -amount, // Credit (negative)
          description: `Revenue posting for Invoice ${invoiceNum}`,
          exchangeRate: rate
        }
      ]
    };
    txsToPost.push(accrualTx);"""

invoice_accrual_new = """    const taxAccount = this.resolveAccount(
      accounts,
      mappings,
      ['tax payable', 'sales tax', 'tax liability', 'tax'],
      a => a.type === 'liability' && (a.name.toLowerCase().includes('tax') || a.category === 'Taxes'),
      'Sales Tax Payable'
    );

    const discountAccount = this.resolveAccount(
      accounts,
      mappings,
      ['discount', 'sales discount'],
      a => a.type === 'expense' || (a.type === 'income' && a.name.toLowerCase().includes('discount')),
      'Sales Discounts'
    );
    
    const retainageAccount = this.resolveAccount(
      accounts,
      mappings,
      ['retainage', 'retention'],
      a => a.type === 'asset' && a.name.toLowerCase().includes('retainage'),
      'Retainage Receivable'
    );

    // 2. Transaction 1: Accrual Posting
    const taxAmount = roundCents((invoiceData.taxAmountCents || invoiceData.salesTaxCents || (invoiceData.taxRate ? (rawAmount / (1 + invoiceData.taxRate)) * invoiceData.taxRate : 0)) * rate);
    const discountAmount = roundCents((invoiceData.discountCents || 0) * rate);
    const retainageAmount = roundCents((invoiceData.retainageCents || 0) * rate);
    
    const revenueAmount = amount + retainageAmount + discountAmount - taxAmount;

    const accrualLines: any[] = [
      {
        accountId: arAccount.id,
        accountName: arAccount.name,
        amountCents: amount, // Debit
        description: `Accounts Receivable posting for Invoice ${invoiceNum}`,
        exchangeRate: rate
      }
    ];

    if (retainageAmount > 0) {
      accrualLines.push({
        accountId: retainageAccount.id,
        accountName: retainageAccount.name,
        amountCents: retainageAmount, // Debit
        description: `Retainage withheld for Invoice ${invoiceNum}`,
        exchangeRate: rate
      });
    }
    if (discountAmount > 0) {
      accrualLines.push({
        accountId: discountAccount.id,
        accountName: discountAccount.name,
        amountCents: discountAmount, // Debit
        description: `Discount applied to Invoice ${invoiceNum}`,
        exchangeRate: rate
      });
    }
    if (taxAmount > 0) {
      accrualLines.push({
        accountId: taxAccount.id,
        accountName: taxAccount.name,
        amountCents: -taxAmount, // Credit
        description: `Sales Tax collected for Invoice ${invoiceNum}`,
        exchangeRate: rate
      });
    }

    accrualLines.push({
      accountId: revenueAccount.id,
      accountName: revenueAccount.name,
      amountCents: -revenueAmount, // Credit
      description: `Revenue posting for Invoice ${invoiceNum}`,
      exchangeRate: rate
    });

    const accrualTx = {
      uid,
      workspaceId,
      date: invoiceDate,
      description: `Invoice ${invoiceNum} - ${customer}`,
      totalAmountCents: amount,
      currency: invoiceData.currency || 'USD',
      exchangeRate: rate,
      status: 'completed',
      type: 'actual',
      createdAt: new Date().toISOString(),
      metadata: {
        invoiceId,
        type: 'invoice-accrual'
      },
      lines: accrualLines
    };
    txsToPost.push(accrualTx);"""

bill_accrual_old = """    // 2. Transaction 1: Accrual Posting (DR Expense, CR A/P)
    const accrualTx = {
      uid,
      workspaceId,
      date: billDate,
      description: `Bill ${billNum} - ${vendor}`,
      totalAmountCents: amount,
      currency: billData.currency || 'USD',
      exchangeRate: rate,
      status: 'completed',
      type: 'actual',
      createdAt: new Date().toISOString(),
      metadata: {
        billId,
        type: 'bill-accrual'
      },
      lines: [
        {
          accountId: expenseAccount.id,
          accountName: expenseAccount.name,
          amountCents: amount, // Debit (positive)
          description: `Expense posting for Bill ${billNum}`,
          exchangeRate: rate
        },
        {
          accountId: apAccount.id,
          accountName: apAccount.name,
          amountCents: -amount, // Credit (negative)
          description: `Accounts Payable posting for Bill ${billNum}`,
          exchangeRate: rate
        }
      ]
    };
    txsToPost.push(accrualTx);"""

bill_accrual_new = """    const taxAccount = this.resolveAccount(
      accounts,
      mappings,
      ['tax paid', 'input tax', 'tax asset', 'tax', 'tax expense'],
      a => (a.type === 'asset' || a.type === 'expense' || a.type === 'liability') && a.name.toLowerCase().includes('tax'),
      'Tax Paid'
    );

    // 2. Transaction 1: Accrual Posting
    const taxAmount = roundCents((billData.taxAmountCents || (billData.taxRate ? (rawAmount / (1 + billData.taxRate)) * billData.taxRate : 0)) * rate);
    const expenseAmount = amount - taxAmount;

    const accrualLines: any[] = [];
    
    if (expenseAmount !== 0) {
      accrualLines.push({
        accountId: expenseAccount.id,
        accountName: expenseAccount.name,
        amountCents: expenseAmount, // Debit
        description: `Expense posting for Bill ${billNum}`,
        exchangeRate: rate
      });
    }
    if (taxAmount > 0) {
      accrualLines.push({
        accountId: taxAccount.id,
        accountName: taxAccount.name,
        amountCents: taxAmount, // Debit
        description: `Tax on Bill ${billNum}`,
        exchangeRate: rate
      });
    }
    accrualLines.push({
      accountId: apAccount.id,
      accountName: apAccount.name,
      amountCents: -amount, // Credit
      description: `Accounts Payable posting for Bill ${billNum}`,
      exchangeRate: rate
    });

    const accrualTx = {
      uid,
      workspaceId,
      date: billDate,
      description: `Bill ${billNum} - ${vendor}`,
      totalAmountCents: amount,
      currency: billData.currency || 'USD',
      exchangeRate: rate,
      status: 'completed',
      type: 'actual',
      createdAt: new Date().toISOString(),
      metadata: {
        billId,
        type: 'bill-accrual'
      },
      lines: accrualLines
    };
    txsToPost.push(accrualTx);"""

if invoice_accrual_old in content:
    content = content.replace(invoice_accrual_old, invoice_accrual_new)
    print("Replaced invoice accrual logic successfully.")
else:
    print("Invoice accrual logic NOT FOUND")

if bill_accrual_old in content:
    content = content.replace(bill_accrual_old, bill_accrual_new)
    print("Replaced bill accrual logic successfully.")
else:
    print("Bill accrual logic NOT FOUND")

with open('src/services/LedgerPostService.ts', 'w') as f:
    f.write(content)
