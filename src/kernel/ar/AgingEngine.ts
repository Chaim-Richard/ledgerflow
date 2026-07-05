export class AgingEngine {
  /**
   * Buckets outstanding invoices into standard AR aging buckets (0-30, 31-60, 61-90, 90+).
   */
  static generateAgingReport(invoices: { id: string, amountCents: number, dueDate: string }[], asOfDate: string): Record<string, number> {
    const buckets = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
      'Current': 0
    };

    const targetDate = new Date(asOfDate).getTime();

    invoices.forEach(inv => {
      const dueDate = new Date(inv.dueDate).getTime();
      const daysOverdue = Math.floor((targetDate - dueDate) / (1000 * 3600 * 24));

      if (daysOverdue <= 0) {
        buckets['Current'] += inv.amountCents;
      } else if (daysOverdue <= 30) {
        buckets['0-30'] += inv.amountCents;
      } else if (daysOverdue <= 60) {
        buckets['31-60'] += inv.amountCents;
      } else if (daysOverdue <= 90) {
        buckets['61-90'] += inv.amountCents;
      } else {
        buckets['90+'] += inv.amountCents;
      }
    });

    return buckets;
  }
}
