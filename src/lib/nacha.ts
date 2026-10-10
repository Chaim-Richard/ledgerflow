/**
 * Direct deposit file (U-09): a pay run's net pay as a NACHA (ACH) file of credits (PPD, service
 * class 220) for the company's bank to send to each employee's account. Whole cents only; nothing
 * is posted (the pay run already is). Format: 94-character records, blocked to multiples of ten.
 */
export type BankAccountType = 'checking' | 'savings';

export interface EmployeeBank { bankRouting?: string; bankAccount?: string; bankAccountType?: BankAccountType }

export interface CompanyBank {
  /** the company's bank (the ACH originator's), 9 digits */
  routing: string;
  /** the company identification the bank gave (often 1 + EIN), 10 characters */
  companyId: string;
  companyName: string;
  bankName?: string;
}

export interface DepositLine { employeeId: string; name: string; netCents: number; bank: EmployeeBank }

/** A US bank routing number: 9 digits with a valid check digit. */
export function validRouting(routing: string | undefined): boolean {
  if (!routing || !/^\d{9}$/.test(routing)) return false;
  const d = [...routing].map(Number);
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
}

export function bankProblem(bank: EmployeeBank): string | null {
  if (!validRouting(bank.bankRouting)) return 'The routing number is 9 digits with a valid check digit';
  if (!bank.bankAccount || !/^[0-9]{4,17}$/.test(bank.bankAccount)) return 'The account number is 4 to 17 digits';
  if (bank.bankAccountType !== 'checking' && bank.bankAccountType !== 'savings') return 'Choose checking or savings';
  return null;
}

export function companyProblem(company: CompanyBank): string | null {
  if (!validRouting(company.routing)) return "Your bank's routing number is 9 digits with a valid check digit";
  if (!/^[A-Za-z0-9 ]{1,10}$/.test(company.companyId.trim())) return 'The company ID your bank gave you is up to 10 letters or digits';
  if (!company.companyName.trim()) return 'Write the company name';
  return null;
}

/** ACH text: capitals, letters, digits and simple punctuation only, cut or padded to the width. */
const alpha = (text: string, width: number) => text.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').toUpperCase().slice(0, width).padEnd(width, ' ');
const num = (value: number | string, width: number) => String(value).padStart(width, '0').slice(-width);
const yymmdd = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);

/**
 * The file's text. `payDate` is the day the money should arrive (the effective entry date); `now`
 * is when the file is made (its header's date and time). Lines without a valid bank or with nothing
 * to pay are left out and returned in `missing`.
 */
export function nachaFile(company: CompanyBank, lines: DepositLine[], payDate: string, now: Date): { text: string; entries: number; totalCents: number; missing: DepositLine[] } {
  const paid = lines.filter(l => l.netCents > 0 && !bankProblem(l.bank));
  const missing = lines.filter(l => !paid.includes(l));
  const odfi = company.routing.slice(0, 8);
  const created = now.toISOString();
  const records: string[] = [];
  records.push('1' + '01' + ` ${company.routing}` + alpha(company.companyId.trim(), 10)
    + yymmdd(created) + created.slice(11, 13) + created.slice(14, 16) + 'A' + '094' + '10' + '1'
    + alpha(company.bankName || '', 23) + alpha(company.companyName, 23) + alpha('', 8));
  records.push('5' + '220' + alpha(company.companyName, 16) + alpha('', 20) + alpha(company.companyId.trim(), 10) + 'PPD' + alpha('PAYROLL', 10)
    + alpha('', 6) + yymmdd(payDate) + '   ' + '1' + odfi + num(1, 7));
  let hash = 0;
  let total = 0;
  paid.forEach((l, i) => {
    const routing = l.bank.bankRouting!;
    hash += Number(routing.slice(0, 8));
    total += Math.round(l.netCents);
    records.push('6' + (l.bank.bankAccountType === 'savings' ? '32' : '22') + routing.slice(0, 8) + routing[8] + alpha(l.bank.bankAccount!, 17)
      + num(Math.round(l.netCents), 10) + alpha(l.employeeId, 15) + alpha(l.name, 22) + '  ' + '0' + odfi + num(i + 1, 7));
  });
  const hashText = num(hash % 10_000_000_000, 10);
  records.push('8' + '220' + num(paid.length, 6) + hashText + num(0, 12) + num(total, 12) + alpha(company.companyId.trim(), 10) + ' '.repeat(19) + ' '.repeat(6) + odfi + num(1, 7));
  const blocks = Math.ceil((records.length + 1) / 10);
  records.push('9' + num(1, 6) + num(blocks, 6) + num(paid.length, 8) + hashText + num(0, 12) + num(total, 12) + ' '.repeat(39));
  while (records.length % 10 !== 0) records.push('9'.repeat(94));
  return { text: records.join('\n') + '\n', entries: paid.length, totalCents: total, missing };
}
