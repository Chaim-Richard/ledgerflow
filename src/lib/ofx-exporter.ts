import { Transaction, ChartAccount } from '../types';
import { resolveAccountRole } from './accountUtils';
import { lineAmount } from './txFilters';

/**
 * Open Financial Exchange (OFX) Export Utility
 * Makes LedgerFlow data compatible with Quicken, QuickBooks, and standard bank imports.
 */
export function generateOFX(transactions: Transaction[], account: ChartAccount): string {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const role = resolveAccountRole(account);

  const curDef = (account.currency || 'USD').toUpperCase();
  const bankId = account.bankId || '999999999';
  const acctId = account.code || account.id;

  let defaultAcctType = 'CHECKING';
  if (role === 'liability' || role === 'ap' || account.type === 'liability') {
    defaultAcctType = 'CREDITLINE';
  } else if (account.subtype?.toLowerCase().includes('saving')) {
    defaultAcctType = 'SAVINGS';
  } else if (account.subtype?.toLowerCase().includes('money')) {
    defaultAcctType = 'MONEYMRKT';
  }
  const acctType = (account.accountType || defaultAcctType).toUpperCase();
  
  const header = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>${timestamp}
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>${timestamp}
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>${curDef}
<BANKACCTFROM>
<BANKID>${bankId}
<ACCTID>${acctId}
<ACCTTYPE>${acctType}
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>${timestamp}
<DTEND>${timestamp}
`;

  const body = transactions.map(tx => {
    // Find the line corresponding to this account to get the specific amount
    const accountLine = tx.lines.find(l => l.accountId === account.id);
    const amountCents = accountLine ? lineAmount(accountLine, tx) : 0;
    const amount = amountCents / 100;
    
    // OFX uses bank/statement perspective:
    // Positive ledger amount (Debit) = deposit / payment towards liability = CREDIT
    // Negative ledger amount (Credit) = withdrawal / new liability charge = DEBIT
    const type = amount >= 0 ? 'CREDIT' : 'DEBIT'; 
    const dtPosted = (tx.date ? tx.date.replace(/-/g, '') : timestamp.slice(0, 8)) + '120000';
    
    return `
<STMTTRN>
<TRNTYPE>${type}
<DTPOSTED>${dtPosted}
<TRNAMT>${amount.toFixed(2)}
<FITID>${tx.id}
<NAME>${(tx.description || 'Transaction').slice(0, 32)}
<MEMO>${tx.description || ''}
</STMTTRN>`;
  }).join('');

  const footer = `
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>${(account.balanceCents / 100).toFixed(2)}
<DTASOF>${timestamp}
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

  return header + body + footer;
}
