export class ApprovalWorkflowEngine {
  static requiresApproval(action: string, amountCents?: number): boolean {
    if (action === 'CREATE_VENDOR') return true;
    if (action === 'DISPOSE_ASSET') return true;
    if (action === 'CREATE_JOURNAL_ENTRY') return true;
    
    // Large expenses require approval
    if (action === 'CREATE_EXPENSE' && amountCents && amountCents > 1000000) { // $10,000.00
      return true;
    }

    return false;
  }

  static getApprovalChain(action: string, amountCents?: number): string[] {
    if (!this.requiresApproval(action, amountCents)) return [];

    const chain = ['Manager'];
    
    if (action === 'CREATE_EXPENSE' && amountCents && amountCents > 5000000) { // > $50k
      chain.push('Admin');
    }
    
    if (action === 'DISPOSE_ASSET') {
      chain.push('Owner');
    }

    return chain;
  }
}
