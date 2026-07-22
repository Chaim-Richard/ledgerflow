import { Transaction, ChartAccount } from '../types';

/**
 * Open Financial Exchange (OFX) Export Utility
 * Makes LedgerFlow data compatible with Quicken, QuickBooks, and standard bank imports.
 */
export function generateOFX(transactions: Transaction[], account: ChartAccount): string {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  
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
<CURDEF>USD
<BANKACCTFROM>
<BANKID>999999999
<ACCTID>${account.code}
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>${timestamp}
<DTEND>${timestamp}
`;

  const body = transactions.map(tx => {
    // Find the line corresponding to this account to get the specific amount
    const accountLine = tx.lines.find(l => l.accountId === account.id);
    const amount = (accountLine?.amountCents || 0) / 100;
    
    // OFX uses bank perspective: DEBIT is money out, CREDIT is money in
    // In our ledger, a positive amount in an Asset account is a DEBIT (money in).
    // This depends on account type. For simplicity, we use the raw sign first.
    const type = amount >= 0 ? 'CREDIT' : 'DEBIT'; 
    const dtPosted = tx.date.replace(/-/g, '') + '120000';
    
    return `
<STMTTRN>
<TRNTYPE>${type}
<DTPOSTED>${dtPosted}
<TRNAMT>${amount.toFixed(2)}
<FITID>${tx.id}
<NAME>${tx.description.slice(0, 32)}
<MEMO>${tx.description}
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
