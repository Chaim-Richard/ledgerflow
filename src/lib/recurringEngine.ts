import { RecurringTransaction, Transaction } from '../types';
import { getLocalDateISO } from './utils';

function parseDateStrToMs(dateStr: string): number {
  if (!dateStr) return NaN;
  const cleanStr = dateStr.slice(0, 10);
  const [y, m, d] = cleanStr.split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return NaN;
  return Date.UTC(y, m - 1, d);
}

export function calculateNextOccurrence(
  currentDateStr: string,
  frequency: RecurringTransaction['frequency'],
  anchorDay: number
): string {
  const [y, m, d] = (currentDateStr || getLocalDateISO()).split('-').map(Number);
  const anchor = anchorDay;

  const addMonths = (n: number) => {
    const targetMonth = m - 1 + n;
    const ty = y + Math.floor(targetMonth / 12);
    const tm = ((targetMonth % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
    return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(Math.min(anchor, lastDay)).padStart(2, '0')}`;
  };

  switch (frequency) {
    case 'daily': {
      const dt = new Date(Date.UTC(y, m - 1, d + 1));
      const year = dt.getUTCFullYear();
      const monthStr = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const dayStr = String(dt.getUTCDate()).padStart(2, '0');
      return `${year}-${monthStr}-${dayStr}`;
    }
    case 'weekly': {
      const dt = new Date(Date.UTC(y, m - 1, d + 7));
      const year = dt.getUTCFullYear();
      const monthStr = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const dayStr = String(dt.getUTCDate()).padStart(2, '0');
      return `${year}-${monthStr}-${dayStr}`;
    }
    case 'monthly':
      return addMonths(1);
    case 'quarterly':
      return addMonths(3);
    case 'yearly':
      return addMonths(12);
    default: {
      const _exhaustive: never = frequency;
      return addMonths(1);
    }
  }
}

export interface DueRecurringResult {
  dueTemplates: RecurringTransaction[];
  generatedTransactions: Array<{
    transaction: Partial<Transaction>;
    templateId: string;
    updatedNextOccurrence: string;
  }>;
}

export function findDueRecurring(recurringList: RecurringTransaction[], asOfDateStr?: string): DueRecurringResult {
  const todayStr = asOfDateStr || getLocalDateISO();
  const asOfTime = parseDateStrToMs(todayStr);

  const dueTemplates: RecurringTransaction[] = [];
  const generatedTransactions: DueRecurringResult['generatedTransactions'] = [];

  for (const item of recurringList) {
    if (!item.isActive) continue;
    
    const currentNextOccStr = item.nextOccurrence || item.createdAt.slice(0, 10);
    let nextOccTime = parseDateStrToMs(currentNextOccStr);

    if (!isNaN(nextOccTime) && nextOccTime <= asOfTime) {
      dueTemplates.push(item);

      const template = (item.template || {}) as Partial<Transaction>;
      const amount = item.amountCents || 0;
      const currency = template.currency || 'USD';
      
      let lines = template.lines;
      if (!lines || lines.length === 0) {
        const primaryAccountId = (template as typeof template & { accountId?: string; accountName?: string; offsetAccountId?: string; offsetAccountName?: string }).accountId || '';
        const primaryAccountName = (template as typeof template & { accountId?: string; accountName?: string; offsetAccountId?: string; offsetAccountName?: string }).accountName || 'Operating Expense';
        const offsetAccountId = (template as typeof template & { accountId?: string; accountName?: string; offsetAccountId?: string; offsetAccountName?: string }).offsetAccountId || '';
        const offsetAccountName = (template as typeof template & { accountId?: string; accountName?: string; offsetAccountId?: string; offsetAccountName?: string }).offsetAccountName || 'Operating Cash';

        lines = [
          {
            accountId: primaryAccountId,
            accountName: primaryAccountName,
            amountCents: amount,
            description: item.description
          },
          {
            accountId: offsetAccountId,
            accountName: offsetAccountName,
            amountCents: -amount,
            description: item.description
          }
        ];
      }

      const anchorDay = item.anchorDay ?? (item.nextOccurrence ? Number(item.nextOccurrence.split('-')[2]) : Number(item.createdAt.slice(0, 10).split('-')[2])) ?? 1;

      // Handle catch-up loop if overdue
      let latestNextOccStr = currentNextOccStr;
      while (nextOccTime <= asOfTime) {
        const newTx: Partial<Transaction> = {
          description: item.description,
          totalAmountCents: amount,
          currency,
          date: latestNextOccStr,
          recurrenceOccurrenceKey: `${item.id}:${latestNextOccStr}`,
          status: 'completed',
          type: 'actual',
          tags: [...(template.tags || []), 'recurring'],
          lines,
          projectId: template.projectId,
          metadata: {
            recurringTemplateId: item.id,
            generatedAt: new Date().toISOString(),
            ...(template.metadata || {})
          }
        };

        latestNextOccStr = calculateNextOccurrence(latestNextOccStr, item.frequency, anchorDay);
        nextOccTime = parseDateStrToMs(latestNextOccStr);

        generatedTransactions.push({
          transaction: newTx,
          templateId: item.id,
          updatedNextOccurrence: latestNextOccStr
        });
      }
    }
  }

  return { dueTemplates, generatedTransactions };
}
