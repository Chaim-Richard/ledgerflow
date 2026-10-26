/** C-97: plain-language accounting glossary. Words only; no report figure or tax advice. */
export interface GlossaryTerm {
  id: string;
  titleEn: string;
  titleHe: string;
  plainEn: string;
  plainHe: string;
  categoryEn: string;
  categoryHe: string;
}

export const GLOSSARY_TERMS: readonly GlossaryTerm[] = [
  { id: 'asset', titleEn: 'Asset', titleHe: 'נכס', categoryEn: 'Basics', categoryHe: 'יסודות', plainEn: 'Something the business owns or is owed, such as cash, a customer balance or equipment.', plainHe: 'דבר שהעסק מחזיק בו או שחייבים לו, כגון מזומן, יתרת לקוח או ציוד.' },
  { id: 'liability', titleEn: 'Liability', titleHe: 'התחייבות', categoryEn: 'Basics', categoryHe: 'יסודות', plainEn: 'Something the business owes, such as an unpaid supplier bill or a loan.', plainHe: 'דבר שהעסק חייב, כגון חשבון ספק שלא שולם או הלוואה.' },
  { id: 'equity', titleEn: 'Equity', titleHe: 'הון עצמי', categoryEn: 'Basics', categoryHe: 'יסודות', plainEn: 'The owners’ share: what remains after liabilities are subtracted from assets.', plainHe: 'חלק הבעלים: מה שנשאר אחרי שמחסירים מהנכסים את ההתחייבויות.' },
  { id: 'revenue', titleEn: 'Revenue', titleHe: 'הכנסה', categoryEn: 'Basics', categoryHe: 'יסודות', plainEn: 'Money earned from sales or services before subtracting costs.', plainHe: 'כסף שהתקבל או נצבר ממכירות או שירותים, לפני הורדת העלויות.' },
  { id: 'expense', titleEn: 'Expense', titleHe: 'הוצאה', categoryEn: 'Basics', categoryHe: 'יסודות', plainEn: 'A cost of running the business, such as rent, wages or software.', plainHe: 'עלות של ניהול העסק, כגון שכירות, שכר עבודה או תוכנה.' },
  { id: 'debit', titleEn: 'Debit', titleHe: 'חובה', categoryEn: 'Basics', categoryHe: 'יסודות', plainEn: 'The left side of a journal entry. Whether it increases an account depends on that account’s type.', plainHe: 'הצד השמאלי של פקודת יומן. אם הוא מגדיל חשבון תלוי בסוג החשבון.' },
  { id: 'credit', titleEn: 'Credit', titleHe: 'זכות', categoryEn: 'Basics', categoryHe: 'יסודות', plainEn: 'The right side of a journal entry. Debits and credits in one entry must balance.', plainHe: 'הצד הימני של פקודת יומן. חובה וזכות באותה פקודה חייבות להתאזן.' },
  { id: 'journal-entry', titleEn: 'Journal entry', titleHe: 'פקודת יומן', categoryEn: 'Basics', categoryHe: 'יסודות', plainEn: 'One dated record of a business event, with balanced debit and credit lines.', plainHe: 'רישום מתוארך אחד של אירוע עסקי, עם שורות חובה וזכות מאוזנות.' },
  { id: 'posting', titleEn: 'Posting', titleHe: 'רישום בספרים', categoryEn: 'Basics', categoryHe: 'יסודות', plainEn: 'Confirming an entry so it counts in posted reports. A draft does not count.', plainHe: 'אישור פקודה כך שתיספר בדוחות של רשומות שנרשמו. טיוטה אינה נספרת.' },
  { id: 'chart-of-accounts', titleEn: 'Chart of accounts', titleHe: 'מחשבות החשבונות', categoryEn: 'Basics', categoryHe: 'יסודות', plainEn: 'The workspace’s list of named accounts and their types, used to classify every line.', plainHe: 'רשימת החשבונות בעלי השמות והסוגים בספרי העסק, המשמשת לסיווג כל שורה.' },
  { id: 'trial-balance', titleEn: 'Trial balance', titleHe: 'מאזן בוחן', categoryEn: 'Reports', categoryHe: 'דוחות', plainEn: 'A list of every account’s debit and credit balance on a date, checking that the totals match.', plainHe: 'רשימת יתרות החובה והזכות של כל חשבון בתאריך, שבודקת שהסכומים מתאימים.' },
  { id: 'profit-and-loss', titleEn: 'Profit & Loss', titleHe: 'רווח והפסד', categoryEn: 'Reports', categoryHe: 'דוחות', plainEn: 'Income, costs and expenses for a period, ending with the period’s profit or loss.', plainHe: 'הכנסות, עלויות והוצאות בתקופה, עם הרווח או ההפסד בסופה.' },
  { id: 'balance-sheet', titleEn: 'Balance Sheet', titleHe: 'מאזן', categoryEn: 'Reports', categoryHe: 'דוחות', plainEn: 'Assets, liabilities and equity on one date, rather than activity across a period.', plainHe: 'נכסים, התחייבויות והון עצמי בתאריך אחד, ולא פעילות לאורך תקופה.' },
  { id: 'cash-flow', titleEn: 'Cash flow', titleHe: 'תזרים מזומנים', categoryEn: 'Reports', categoryHe: 'דוחות', plainEn: 'Money moving into and out of cash and bank accounts during a period.', plainHe: 'כסף שנכנס ויוצא מחשבונות מזומן ובנק במהלך תקופה.' },
  { id: 'accrual', titleEn: 'Accrual basis', titleHe: 'בסיס מצטבר', categoryEn: 'Reports', categoryHe: 'דוחות', plainEn: 'Records income and costs when they are earned or incurred, not only when cash moves.', plainHe: 'רושם הכנסות ועלויות כשהן נצברות או נוצרות, לא רק כשמזומן זז.' },
  { id: 'cash-basis', titleEn: 'Cash basis', titleHe: 'בסיס מזומן', categoryEn: 'Reports', categoryHe: 'דוחות', plainEn: 'Records income and costs when cash is actually received or paid.', plainHe: 'רושם הכנסות ועלויות כאשר מזומן מתקבל או משולם בפועל.' },
  { id: 'accounts-receivable', titleEn: 'Accounts receivable', titleHe: 'חייבים ולקוחות', categoryEn: 'Documents', categoryHe: 'מסמכים', plainEn: 'Money customers still owe for issued invoices.', plainHe: 'כסף שלקוחות עדיין חייבים עבור חשבוניות שהונפקו.' },
  { id: 'accounts-payable', titleEn: 'Accounts payable', titleHe: 'זכאים וספקים', categoryEn: 'Documents', categoryHe: 'מסמכים', plainEn: 'Money the business still owes suppliers for recorded bills.', plainHe: 'כסף שהעסק עדיין חייב לספקים עבור חשבונות שנרשמו.' },
  { id: 'invoice', titleEn: 'Invoice', titleHe: 'חשבונית מכירה', categoryEn: 'Documents', categoryHe: 'מסמכים', plainEn: 'A document asking a customer to pay for goods or services.', plainHe: 'מסמך שמבקש מלקוח לשלם עבור סחורה או שירות.' },
  { id: 'bill', titleEn: 'Bill', titleHe: 'חשבון ספק', categoryEn: 'Documents', categoryHe: 'מסמכים', plainEn: 'A supplier’s request for payment that the business records as a cost or asset.', plainHe: 'דרישת תשלום של ספק שהעסק רושם כעלות או כנכס.' },
  { id: 'credit-note', titleEn: 'Credit note', titleHe: 'זיכוי', categoryEn: 'Documents', categoryHe: 'מסמכים', plainEn: 'A document that reduces what a customer owes, usually after a return or correction.', plainHe: 'מסמך שמקטין את מה שלקוח חייב, לרוב אחרי החזרה או תיקון.' },
  { id: 'payment', titleEn: 'Payment', titleHe: 'תשלום', categoryEn: 'Documents', categoryHe: 'מסמכים', plainEn: 'Money received from a customer or paid to a supplier, separate from the invoice or bill.', plainHe: 'כסף שהתקבל מלקוח או שולם לספק, בנפרד מהחשבונית או חשבון הספק.' },
  { id: 'allocation', titleEn: 'Allocation', titleHe: 'התאמת תשלום', categoryEn: 'Documents', categoryHe: 'מסמכים', plainEn: 'Linking a payment to the invoice or bill it settles.', plainHe: 'קישור תשלום לחשבונית או לחשבון הספק שהוא מכסה.' },
  { id: 'reconciliation', titleEn: 'Reconciliation', titleHe: 'התאמת בנק', categoryEn: 'Documents', categoryHe: 'מסמכים', plainEn: 'Matching bank statement lines with the entries already in the books.', plainHe: 'התאמת שורות דף הבנק לפקודות שכבר רשומות בספרים.' },
  { id: 'opening-balance', titleEn: 'Opening balance', titleHe: 'יתרת פתיחה', categoryEn: 'Basics', categoryHe: 'יסודות', plainEn: 'The amount an account starts with when books are opened or moved from another system.', plainHe: 'הסכום שבו חשבון מתחיל כשפותחים ספרים או מעבירים אותם ממערכת אחרת.' },
  { id: 'period-lock', titleEn: 'Period lock', titleHe: 'נעילת תקופה', categoryEn: 'Controls', categoryHe: 'בקרה', plainEn: 'A rule that stops changes to posted records in a closed period without an authorised reopen.', plainHe: 'כלל שמונע שינוי רשומות שנרשמו בתקופה סגורה, ללא פתיחה מורשית.' },
  { id: 'audit-trail', titleEn: 'Audit trail', titleHe: 'יומן ביקורת', categoryEn: 'Controls', categoryHe: 'בקרה', plainEn: 'A record of who changed what and when. It is not an opinion on whether the figures are correct.', plainHe: 'רישום של מי שינה מה ומתי. אין בו חוות דעת על נכונות המספרים.' },
  { id: 'depreciation', titleEn: 'Depreciation', titleHe: 'פחת', categoryEn: 'Assets & stock', categoryHe: 'נכסים ומלאי', plainEn: 'Spreading the cost of a long-lived asset over the periods that use it.', plainHe: 'פיזור עלות של נכס לשימוש ארוך טווח על פני התקופות שמשתמשות בו.' },
  { id: 'inventory', titleEn: 'Inventory', titleHe: 'מלאי', categoryEn: 'Assets & stock', categoryHe: 'נכסים ומלאי', plainEn: 'Goods held for sale, counted in units and valued using the workspace’s stock method.', plainHe: 'סחורה שמוחזקת למכירה, נספרת ביחידות ומוערכת בשיטת המלאי של הספרים.' },
  { id: 'cogs', titleEn: 'Cost of goods sold', titleHe: 'עלות המכר', categoryEn: 'Assets & stock', categoryHe: 'נכסים ומלאי', plainEn: 'The recorded cost of the goods sold in a period, not the sale price.', plainHe: 'העלות הרשומה של הסחורה שנמכרה בתקופה, לא מחיר המכירה.' },
  { id: 'vat', titleEn: 'VAT', titleHe: 'מע"מ', categoryEn: 'Tax', categoryHe: 'מס', plainEn: 'Value-added tax collected on sales and paid on purchases; a report is not a filing.', plainHe: 'מס ערך מוסף שנגבה על מכירות ומשולם על רכישות; דוח אינו הגשה לרשות המסים.' },
  { id: 'sales-tax', titleEn: 'Sales tax', titleHe: 'מס מכירה', categoryEn: 'Tax', categoryHe: 'מס', plainEn: 'Tax on a sale calculated from the place, item and dated rules that apply to that line.', plainHe: 'מס על מכירה שמחושב לפי המקום, הפריט והכללים המתוארכים שחלים על השורה.' },
  { id: 'withholding', titleEn: 'Withholding tax', titleHe: 'ניכוי במקור', categoryEn: 'Tax', categoryHe: 'מס', plainEn: 'Tax held back from a payment and recorded for the payer and recipient.', plainHe: 'מס שנוכה מתשלום ונרשם עבור המשלם והמקבל.' },
  { id: 'fiscal-period', titleEn: 'Fiscal period', titleHe: 'תקופה פיסקלית', categoryEn: 'Controls', categoryHe: 'בקרה', plainEn: 'The workspace’s month, quarter or year used to group reports and close the books.', plainHe: 'החודש, הרבעון או השנה של העסק, המשמשים לקיבוץ דוחות ולסגירת הספרים.' },
  { id: 'exchange-rate', titleEn: 'Exchange rate', titleHe: 'שער חליפין', categoryEn: 'Currency', categoryHe: 'מטבע', plainEn: 'The rate recorded on a foreign-currency document to convert it into the books’ currency.', plainHe: 'השער שנרשם במסמך במטבע זר כדי להמיר אותו למטבע הספרים.' },
  { id: 'base-currency', titleEn: 'Base currency', titleHe: 'מטבע בסיס', categoryEn: 'Currency', categoryHe: 'מטבע', plainEn: 'The currency the workspace uses for its main reports and totals.', plainHe: 'המטבע שהעסק משתמש בו לדוחות ולסכומים הראשיים.' },
] as const;

/** Searches exact Unicode text in both languages; no ASCII-only transliteration or identity guess. */
export function searchGlossary(query: string, terms: readonly GlossaryTerm[] = GLOSSARY_TERMS): GlossaryTerm[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...terms];
  return terms.filter(term => [term.titleEn, term.titleHe, term.plainEn, term.plainHe, term.categoryEn, term.categoryHe]
    .some(value => value.toLocaleLowerCase().includes(needle)));
}
