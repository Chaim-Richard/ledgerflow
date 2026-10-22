/**
 * A-202: "what does this number mean?" for the ten report totals a reader is most likely to take
 * at face value.
 *
 * Every sentence here was written against the code that produces the figure, not against what the
 * figure is usually called:
 * - `pnl`            → `calculateNetIncome` / the server P&L (`src/lib/txFilters.ts`, `src/server/reports/computeReports.ts`)
 * - `balance-sheet`  → `computeBalanceSheet` (same file)
 * - `cash-flow`      → `computeCashFlow` (same file)
 * - `ar-aging` / `ap-aging` → `computePartyAging` (`src/lib/aging.ts`)
 * - `inventory-valuation`   → `computeInventoryValuation` (`src/server/reports/itemReports.ts`)
 * - `tax-liability`  → `buildTaxReturn` (`src/lib/taxReturnDocs.ts`)
 * - `financial-ratios` → `financialRatiosReport` (`src/lib/financialRatiosReport.ts`)
 *
 * The four fields are deliberately separate: `what` names the figure, `includes` and `leavesOut`
 * bound it, and `notProves` says what a reader must not conclude from it. If a figure's definition
 * changes, this file must change with it — `report-total-explanations.test.ts` keeps every entry
 * pointed at a registered report and keeps both languages present, but only a person can keep the
 * words true.
 */
export interface LocalizedText {
  en: string;
  he: string;
}

export interface ReportTotalExplanation {
  /** stable id for keys and tests */
  id: string;
  /** registry id of the report the total is printed on */
  reportId: string;
  /** the total's name, in the report's own words */
  total: LocalizedText;
  /** one sentence: what the figure is */
  what: LocalizedText;
  /** what the figure counts */
  includes: LocalizedText;
  /** what a reader might expect it to count, and it does not */
  leavesOut: LocalizedText;
  /** what the figure must not be read as proof of */
  notProves: LocalizedText;
}

export const REPORT_TOTAL_EXPLANATIONS: readonly ReportTotalExplanation[] = [
  {
    id: 'pnl-net-profit',
    reportId: 'pnl',
    total: { en: 'Net profit', he: 'רווח נקי' },
    what: {
      en: 'Income minus cost of goods sold minus expenses, from the entries posted in the chosen period.',
      he: 'הכנסות פחות עלות המכר פחות הוצאות, מתוך הפקודות שנרשמו בתקופה שנבחרה.',
    },
    includes: {
      en: 'Every posted entry dated inside the period, including journal entries, credit notes and vendor credits that were posted.',
      he: 'כל פקודה שנרשמה בתאריך בתוך התקופה, כולל פקודות יומן, כתבי אשראי וזיכויי ספקים שנרשמו.',
    },
    leavesOut: {
      en: 'Draft and void entries, anything dated outside the period, and opening balances (a P&L measures a period, not a position).',
      he: 'טיוטות ופקודות מבוטלות, כל תאריך מחוץ לתקופה, ויתרות פתיחה, מפני שרווח והפסד מודד תקופה ולא מצב.',
    },
    notProves: {
      en: 'That the money arrived, that every sale was invoiced, or that the history loaded in this browser is complete.',
      he: 'שהכסף התקבל, שכל מכירה הונפקה בחשבונית, או שההיסטוריה שנטענה בדפדפן שלמה.',
    },
  },
  {
    id: 'pnl-gross-profit',
    reportId: 'pnl',
    total: { en: 'Gross profit', he: 'רווח גולמי' },
    what: {
      en: 'Income minus cost of goods sold only; it is what is left before rent, salaries and every other operating expense.',
      he: 'הכנסות פחות עלות המכר בלבד: מה שנשאר לפני שכר דירה, משכורות וכל הוצאת תפעול אחרת.',
    },
    includes: {
      en: 'The same posted income and cost-of-goods accounts the net profit uses.',
      he: 'אותן הכנסות ואותו חשבון עלות מכר שמשמשים ברווח הנקי.',
    },
    leavesOut: {
      en: 'Operating expenses, interest, tax and anything not classified as cost of goods sold in the chart of accounts.',
      he: 'הוצאות תפעול, ריבית, מס וכל מה שאינו מסווג כעלות מכר במערכת החשבונות.',
    },
    notProves: {
      en: 'That the margin is sustainable, or that the cost posted for each sale is the true purchase cost — a missing cost line shows as more profit.',
      he: 'שהמרווח בר־קיימא, או שהעלות שנרשמה לכל מכירה היא עלות הקנייה האמיתית; שורת עלות חסרה נראית כרווח גבוה יותר.',
    },
  },
  {
    id: 'balance-sheet-total-assets',
    reportId: 'balance-sheet',
    total: { en: 'Total assets', he: 'סך הנכסים' },
    what: {
      en: 'The debit balances of every asset account at the end date, including opening balances and all posted activity up to that date.',
      he: 'יתרות החובה של כל חשבונות הנכסים בתאריך הסיום, כולל יתרות פתיחה וכל הפעילות שנרשמה עד אותו תאריך.',
    },
    includes: {
      en: 'Cash, receivables, inventory, fixed assets and any other account typed as an asset in the chart of accounts.',
      he: 'מזומן, לקוחות, מלאי, רכוש קבוע וכל חשבון אחר שסווג כנכס במערכת החשבונות.',
    },
    leavesOut: {
      en: 'Lines on accounts that no longer exist in the chart (they are listed separately as orphaned), and drafts or void entries.',
      he: 'שורות בחשבונות שאינם קיימים עוד במערכת (הן מוצגות בנפרד כיתומות), וטיוטות או פקודות מבוטלות.',
    },
    notProves: {
      en: 'That the assets exist, that they could be sold for that amount, or that the sheet balances — the sheet says by how much when assets do not equal liabilities plus equity plus profit.',
      he: 'שהנכסים קיימים, שאפשר למכור אותם בסכום הזה, או שהמאזן מתאזן; המסך אומר בכמה כשנכסים אינם שווים להתחייבויות ועוד הון ועוד רווח.',
    },
  },
  {
    id: 'balance-sheet-total-equity',
    reportId: 'balance-sheet',
    total: { en: 'Total equity', he: 'סך ההון העצמי' },
    what: {
      en: 'The credit balances of the equity accounts only; the profit earned to date is shown beside it and is not part of this figure.',
      he: 'יתרות הזכות של חשבונות ההון בלבד; הרווח שנצבר עד התאריך מוצג לצידו ואינו חלק מהמספר הזה.',
    },
    includes: {
      en: 'Share capital, owner contributions and withdrawals, reserves and any other account typed as equity.',
      he: 'הון מניות, הפקדות ומשיכות בעלים, קרנות וכל חשבון אחר שסווג כהון עצמי.',
    },
    leavesOut: {
      en: 'The profit of the period and of earlier periods that was never closed into an equity account; that is the separate profit line.',
      he: 'הרווח של התקופה ושל תקופות קודמות שלא נסגר לחשבון הון; זהו קו הרווח הנפרד.',
    },
    notProves: {
      en: 'What the business is worth, or that the owners agree with the recorded contributions.',
      he: 'מה שווה העסק, או שבעלי המניות מסכימים להפקדות שנרשמו.',
    },
  },
  {
    id: 'cash-flow-net-change',
    reportId: 'cash-flow',
    total: { en: 'Net change in cash', he: 'שינוי נטו במזומן' },
    what: {
      en: 'Operating plus investing plus financing movement of the period: how much cash the posted entries moved, not how much cash there is.',
      he: 'התנועה התפעולית ועוד השקעות ועוד מימון בתקופה: כמה מזומן הפקודות שנרשמו הזיזו, ולא כמה מזומן יש.',
    },
    includes: {
      en: 'Only entries that touch an account typed as cash or bank; each other side is classified as operating, investing or financing by its account.',
      he: 'רק פקודות שנוגעות בחשבון מסוג מזומן או בנק; כל צד שני מסווג לתפעולי, להשקעות או למימון לפי החשבון שלו.',
    },
    leavesOut: {
      en: 'The opening cash balance, so the figure is a change and not a closing balance, and entries with no cash side at all.',
      he: 'יתרת המזומן בפתיחה, ולכן המספר הוא שינוי ולא יתרת סגירה, ופקודות שאין בהן צד מזומן כלל.',
    },
    notProves: {
      en: 'That the bank statement agrees, that every receipt was recorded, or what will happen next period.',
      he: 'שדף הבנק מותאם, שכל תקבול נרשם, או מה יקרה בתקופה הבאה.',
    },
  },
  {
    id: 'ar-aging-total',
    reportId: 'ar-aging',
    total: { en: 'Total outstanding (customers)', he: 'סך החוב הפתוח (לקוחות)' },
    what: {
      en: 'What is still due on issued customer invoices that are not fully paid, added up and aged from each invoice\'s due date, in the base currency.',
      he: 'מה שעוד לא שולם מחשבוניות שהונפקו ללקוחות, מסוכם ומגולח מתאריך הפירעון של כל חשבונית, במטבע הבסיס.',
    },
    includes: {
      en: 'Every invoice with an amount due today, including invoices already past their due date, each translated at the rate stored on the invoice.',
      he: 'כל חשבונית שיש לה סכום לתשלום היום, כולל חשבוניות שעברו את מועד הפירעון, כל אחת בשער שנשמר בחשבונית.',
    },
    leavesOut: {
      en: 'Unapplied customer credits and overpayments, ledger journals that debit receivables, and drafts or void invoices — so this is not the receivables account balance.',
      he: 'זיכויים ותשלומי עודף של לקוחות שלא הוחלו, פקודות יומן לחובת לקוחות, וטיוטות או חשבוניות מבוטלות; לכן זה אינו יתרת חשבון הלקוחות.',
    },
    notProves: {
      en: 'That the customer will pay, or that the receivables account in the trial balance shows the same number.',
      he: 'שהלקוח ישלם, או שחשבון הלקוחות במאזן הבוחן מראה את אותו מספר.',
    },
  },
  {
    id: 'ap-aging-total',
    reportId: 'ap-aging',
    total: { en: 'Total outstanding (suppliers)', he: 'סך החוב הפתוח (ספקים)' },
    what: {
      en: 'What is still to pay on supplier bills that are not fully paid, added up and aged from each bill\'s due date, in the base currency.',
      he: 'מה שנותר לשלם מחשבונות ספקים שלא שולמו במלואם, מסוכם ומגולח מתאריך הפירעון של כל חשבון, במטבע הבסיס.',
    },
    includes: {
      en: 'Every bill with an amount still to pay, including bills past their due date, each at the rate stored on the bill.',
      he: 'כל חשבון שיש בו סכום לתשלום, כולל חשבונות שעברו את מועד הפירעון, כל אחד בשער שנשמר בחשבון.',
    },
    leavesOut: {
      en: 'Vendor credits and prepayments that were not applied to a bill, ledger journals that credit suppliers, and drafts or void bills.',
      he: 'זיכויי ספקים ומקדמות שלא קוזזו מול חשבון, פקודות יומן לזכות ספקים, וטיוטות או חשבונות מבוטלים.',
    },
    notProves: {
      en: 'That the bill is correct, that it was approved, or that the payable account in the trial balance shows the same number.',
      he: 'שהחשבון נכון, שהוא אושר, או שחשבון הספקים במאזן הבוחן מראה את אותו מספר.',
    },
  },
  {
    id: 'inventory-valuation-total',
    reportId: 'inventory-valuation',
    total: { en: 'Total stock value', he: 'סך שווי המלאי' },
    what: {
      en: 'Quantity on hand times the unit cost recorded on each item: what the stock is carried at today, at that cost.',
      he: 'כמות במלאי כפול עלות היחידה שנרשמה לכל פריט: השווי שבו המלאי מוחזק היום, לפי אותה עלות.',
    },
    includes: {
      en: 'Every item with a positive quantity; an item priced at zero cost counts with zero, and a negative quantity is valued at zero with a note.',
      he: 'כל פריט עם כמות חיובית; פריט שעלותו אפס נספר באפס, וכמות שלילית מוערכת באפס עם הערה.',
    },
    leavesOut: {
      en: 'Freight and duty that were never added to the item\'s unit cost, and items whose unit cost was never filled in.',
      he: 'הובלה ומכס שלא נוספו לעלות היחידה של הפריט, ופריטים שעלות היחידה שלהם לא הוזנה.',
    },
    notProves: {
      en: 'What the stock would sell for, or that it equals the Inventory account — the report prints the difference to that account beside the total.',
      he: 'בכמה אפשר למכור את המלאי, או שהוא שווה לחשבון המלאי; הדוח מציג את הפער מול אותו חשבון לצד הסה״כ.',
    },
  },
  {
    id: 'tax-liability-due',
    reportId: 'tax-liability',
    total: { en: 'Tax for the period', he: 'המס לתקופה' },
    what: {
      en: 'Tax charged on sales documents minus tax on purchase documents of the period, built box by box from the documents themselves.',
      he: 'המס שנגבה במסמכי מכירה פחות המס במסמכי רכישה בתקופה, לפי תיבות, מתוך המסמכים עצמם.',
    },
    includes: {
      en: 'Issued invoices, bills, credit notes and vendor credits whose status counts as issued or open in the period, each in the base currency at its stored rate.',
      he: 'חשבוניות שהונפקו, חשבונות, כתבי אשראי וזיכויי ספקים שסטטוסם נחשב להונפק או פתוח בתקופה, כל אחד במטבע הבסיס בשער שנשמר.',
    },
    leavesOut: {
      en: 'Tax already paid to the authority, drafts and cancelled documents, and any rate the documents did not record — nothing is re-rated here.',
      he: 'מס שכבר שולם לרשות, טיוטות ומסמכים מבוטלים, וכל שיעור שהמסמכים לא רשמו; אין כאן חישוב שיעור מחדש.',
    },
    notProves: {
      en: 'That filing is correct or filing-ready: it does not decide place of supply, exemptions or nexus, and it is not an authority\'s return.',
      he: 'שההגשה נכונה או מוכנה להגשה: הוא אינו מכריע מקום אספקה, פטורים או נקסוס, ואינו דוח של הרשות.',
    },
  },
  {
    id: 'financial-ratios-current',
    reportId: 'financial-ratios',
    total: { en: 'Current ratio', he: 'יחס שוטף' },
    what: {
      en: 'Current assets divided by current liabilities, using the posted statement amounts and the current-account groups chosen on the report.',
      he: 'נכסים שוטפים חלקי התחייבויות שוטפות, לפי סכומי הדוח שנרשמו וקבוצות החשבונות השוטפים שנבחרו בדוח.',
    },
    includes: {
      en: 'By default Cash, Receivables and Inventory as current assets and Payables and Tax as current liabilities; every change you make to those groups applies to this report only.',
      he: 'כברירת מחדל מזומן, לקוחות ומלאי כנכסים שוטפים, וספקים ומס כהתחייבויות שוטפות; כל שינוי בקבוצות חל על הדוח הזה בלבד.',
    },
    leavesOut: {
      en: 'Accounts you leave out of the groups, commitments that are not on the balance sheet, and the timing of when each item turns into cash.',
      he: 'חשבונות שהוצאתם מהקבוצות, התחייבויות שאינן במאזן, והתזמון שבו כל פריט הופך למזומן.',
    },
    notProves: {
      en: 'That the business can pay its bills next month; when current liabilities are zero the ratio is shown as undefined rather than as a perfect score.',
      he: 'שהעסק יכול לשלם את חשבונותיו בחודש הבא; כשהתחייבויות שוטפות אפס היחס מוצג כלא מוגדר ולא כציון מושלם.',
    },
  },
];

/** The explanations that belong on one report, in the order they are listed above. */
export function explanationsForReport(reportId: string): ReportTotalExplanation[] {
  return REPORT_TOTAL_EXPLANATIONS.filter((entry) => entry.reportId === reportId);
}

/** Index by id, for tests and for a report that wants to explain a single figure. */
export function explanationById(id: string): ReportTotalExplanation | undefined {
  return REPORT_TOTAL_EXPLANATIONS.find((entry) => entry.id === id);
}
