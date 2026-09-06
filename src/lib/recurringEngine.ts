import { RecurringTransaction, Transaction } from '../types';
import { parseLocalDate } from './utils';

export function calculateNextOccurrence(currentDateStr: string, frequency: RecurringTransaction['frequency']): string {
  const date = parseLocalDate(currentDateStr || new Date().toISOString().slice(0, 10));
  if (isNaN(date.getTime())) {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }

  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
  const todayStr = asOfDateStr || new Date().toISOString().slice(0, 10);
  const asOfTime = parseLocalDate(todayStr).getTime();

  const dueTemplates: RecurringTransaction[] = [];
  const generatedTransactions: DueRecurringResult['generatedTransactions'] = [];

  for (const item of recurringList) {
    if (!item.isActive) continue;
    
    const currentNextOccStr = item.nextOccurrence || item.createdAt.slice(0, 10);
    let nextOccTime = parseLocalDate(currentNextOccStr).getTime();

    if (!isNaN(nextOccTime) && nextOccTime <= asOfTime) {
      dueTemplates.push(item);

      const template = (item.template || {}) as Partial<Transaction>;
      const amount = item.amountCents || template.totalAmountCents || 0;
      const currency = template.currency || 'USD';
      
      let lines = template.lines;
      if (!lines || lines.length === 0) {
        const primaryAccountId = (template as any).accountId || 'uncategorized';
        const primaryAccountName = (template as any).accountName || 'Operating Expense';
        const offsetAccountId = (template as any).offsetAccountId || 'uncategorized';
        const offsetAccountName = (template as any).offsetAccountName || 'Operating Cash';

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

      // Handle catch-up loop if overdue
      let latestNextOccStr = currentNextOccStr;
      while (nextOccTime <= asOfTime) {
        const newTx: Partial<Transaction> = {
          description: item.description,
          totalAmountCents: amount,
          currency,
          date: latestNextOccStr,
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

        latestNextOccStr = calculateNextOccurrence(latestNextOccStr, item.frequency);
        nextOccTime = parseLocalDate(latestNextOccStr).getTime();

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
