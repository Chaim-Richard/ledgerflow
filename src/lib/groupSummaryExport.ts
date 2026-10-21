import { downloadCsv } from './csvExport';
import { formatCurrency } from './utils';

export interface GroupSummaryFigures {
  income: number;
  cogs: number;
  grossProfit: number;
  expense: number;
  netIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

export interface GroupSummaryMemberExport extends GroupSummaryFigures {
  workspaceId: string;
  name: string;
  currency: string;
  isBalanced: boolean;
  share?: number;
  associate?: boolean;
  translated?: GroupSummaryFigures & { cta: number };
}

export interface GroupSummaryEliminatedExport {
  assets: number;
  liabilities: number;
  difference: number;
  income?: number;
  cogs?: number;
  expense?: number;
  profitDifference?: number;
  investment?: number;
  goodwill?: number;
  belowBookValue?: number;
}

export interface GroupSummaryAccountLineExport {
  key: string;
  section: 'income' | 'cogs' | 'expense' | 'asset' | 'liability' | 'equity';
  name: string;
  code?: string;
  byMember: Record<string, number>;
  total: number;
}

export interface GroupSummaryExportData {
  group: { id: string; name: string };
  members: GroupSummaryMemberExport[];
  total: (GroupSummaryFigures & {
    currency: string;
    cta?: number;
    eliminated?: GroupSummaryEliminatedExport;
    otherOwners?: { equity: number; netIncome: number };
    associates?: { profit: number; equity: number };
  }) | null;
  accountLines?: GroupSummaryAccountLineExport[];
}

const SUMMARY_ROWS: ReadonlyArray<{ key: keyof GroupSummaryFigures; label: string }> = [
  { key: 'income', label: 'Income' },
  { key: 'cogs', label: 'Cost of goods sold' },
  { key: 'grossProfit', label: 'Gross profit' },
  { key: 'expense', label: 'Expenses' },
  { key: 'netIncome', label: 'Net income' },
  { key: 'totalAssets', label: 'Total assets' },
  { key: 'totalLiabilities', label: 'Total liabilities' },
  { key: 'totalEquity', label: 'Equity (with this year’s profit)' },
];

export function buildGroupSummaryCsvRows(summary: GroupSummaryExportData): {
  headers: string[];
  rows: string[][];
} {
  const headers = [
    'Line',
    ...summary.members.map(member => member.name),
    ...(summary.total ? ['Group total'] : []),
  ];

  const rows: string[][] = [];

  for (const row of SUMMARY_ROWS) {
    const memberCells = summary.members.map(member =>
      member.translated && summary.total
        ? formatCurrency(member.translated[row.key], summary.total.currency)
        : formatCurrency(member[row.key], member.currency),
    );
    const totalCell = summary.total
      ? [formatCurrency(summary.total[row.key], summary.total.currency)]
      : [];
    rows.push([row.label, ...memberCells, ...totalCell]);
  }

  if (summary.members.some(member => member.translated) && summary.total) {
    rows.push([
      'of which translation difference',
      ...summary.members.map(member =>
        formatCurrency(member.translated?.cta || 0, summary.total!.currency),
      ),
      formatCurrency(summary.total.cta || 0, summary.total.currency),
    ]);
  }

  if (summary.total?.eliminated) {
    const elim = summary.total.eliminated;
    const blankMembers = summary.members.map(() => '');
    if (elim.assets !== 0 || elim.liabilities !== 0) {
      rows.push([
        'Eliminated intercompany assets',
        ...blankMembers,
        formatCurrency(elim.assets, summary.total.currency),
      ]);
      rows.push([
        'Eliminated intercompany liabilities',
        ...blankMembers,
        formatCurrency(elim.liabilities, summary.total.currency),
      ]);
    }
    if (elim.income || elim.cogs || elim.expense) {
      rows.push([
        'Eliminated intercompany income',
        ...blankMembers,
        formatCurrency(elim.income || 0, summary.total.currency),
      ]);
      rows.push([
        'Eliminated intercompany costs',
        ...blankMembers,
        formatCurrency((elim.cogs || 0) + (elim.expense || 0), summary.total.currency),
      ]);
    }
  }

  if (summary.accountLines && summary.total) {
    for (const line of summary.accountLines) {
      const label = line.code ? `${line.code} ${line.name}` : line.name;
      rows.push([
        label,
        ...summary.members.map(member =>
          line.byMember[member.workspaceId]
            ? formatCurrency(line.byMember[member.workspaceId], summary.total!.currency)
            : '',
        ),
        formatCurrency(line.total, summary.total.currency),
      ]);
    }
  }

  return { headers, rows };
}

export function exportGroupSummaryCsv(
  summary: GroupSummaryExportData,
  startDate: string,
  endDate: string,
): void {
  const { headers, rows } = buildGroupSummaryCsvRows(summary);
  const safeSlug = summary.group.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'group';
  downloadCsv(`group-summary-${safeSlug}-${startDate}-to-${endDate}`, headers, rows);
}
