import { RecurringTransaction, Transaction, Invoice } from '../types';

export function calculateNextOccurrence(currentDateStr: string, frequency: RecurringTransaction['frequency']): string {
  const date = new Date(currentDateStr || new Date().toISOString());
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

  return date.toISOString().slice(0, 10);
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
  const asOf = asOfDateStr ? new Date(asOfDateStr) : new Date();
  asOf.setHours(23, 59, 59, 999);

  const dueTemplates: RecurringTransaction[] = [];
  const generatedTransactions: DueRecurringResult['generatedTransactions'] = [];

  for (const item of recurringList) {
    if (!item.isActive) continue;
    
    const nextOcc = new Date(item.nextOccurrence || item.createdAt);
    if (!isNaN(nextOcc.getTime()) && nextOcc <= asOf) {
      dueTemplates.push(item);

      const template = (item.template || {}) as any;
      const amount = item.amountCents || template.amountCents || template.totalAmountCents || 0;
      
      const newTx: Partial<Transaction> = {
        description: item.description,
        totalAmountCents: amount,
        currency: 'USD',
        date: item.nextOccurrence.slice(0, 10),
        status: 'pending',
        type: 'actual',
        tags: [...(template.tags || []), 'recurring'],
        lines: template.lines || [
          {
            accountId: template.accountId || 'uncategorized',
            accountName: template.accountName || 'Uncategorized',
            amountCents: amount,
            description: item.description
          }
        ],
        projectId: template.projectId,
        metadata: {
          recurringTemplateId: item.id,
          vendorId: template.vendorId,
          customerId: template.customerId,
          generatedAt: new Date().toISOString(),
          ...(template.metadata || {})
        }
      };

      const updatedNext = calculateNextOccurrence(item.nextOccurrence, item.frequency);

      generatedTransactions.push({
        transaction: newTx,
        templateId: item.id,
        updatedNextOccurrence: updatedNext
      });
    }
  }

  return { dueTemplates, generatedTransactions };
}
