import { Transaction } from '../../types';
import { AlgorithmDefinition } from './types';

// Association Rule Mining (Apriori-lite) to convert manual/probabilistic choices into deterministic rules
export function induceRules(transactions: readonly Transaction[], minSupport: number = 3, minConfidence: number = 0.85) {
    const patternCounts = new Map<string, number>();
    const patternAccountCounts = new Map<string, Map<string, number>>();

    transactions.forEach(t => {
        // Skip unverified or unknown
        if (!t.verification || t.verification.status !== 'verified') return;
        
        t.lines?.forEach(line => {
            if (!line.accountName || line.accountName === 'Uncategorized') return;
            
            // Extract the vendor or description prefix
            const desc = (line.description || t.description || '').toLowerCase();
            const words = desc.replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 2);
            
            // Generate 1-gram and 2-gram patterns
            const patterns = [];
            if (words[0]) patterns.push(words[0]);
            if (words[0] && words[1]) patterns.push(`${words[0]} ${words[1]}`);

            patterns.forEach(pattern => {
                patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
                
                if (!patternAccountCounts.has(pattern)) {
                    patternAccountCounts.set(pattern, new Map());
                }
                const accountMap = patternAccountCounts.get(pattern)!;
                accountMap.set(line.accountName, (accountMap.get(line.accountName) || 0) + 1);
            });
        });
    });

    const proposedRules = [];

    // Evaluate rules
    for (const [pattern, totalCount] of patternCounts.entries()) {
        if (totalCount < minSupport) continue; // Not enough evidence

        const accountMap = patternAccountCounts.get(pattern)!;
        let bestAccount = '';
        let highestCount = 0;

        for (const [account, count] of accountMap.entries()) {
            if (count > highestCount) {
                highestCount = count;
                bestAccount = account;
            }
        }

        const confidence = highestCount / totalCount;

        if (confidence >= minConfidence) {
            proposedRules.push({
                condition: pattern,
                targetAccount: bestAccount,
                support: totalCount,
                confidence: confidence,
                type: 'description_starts_with'
            });
        }
    }

    return proposedRules.sort((a,b) => b.confidence * b.support - a.confidence * a.support);
}

export const RULE_INDUCTION_ALGO: AlgorithmDefinition = {
  id: 'rule_induction',
  domain: 'operations',
  name: 'Deterministic Rule Induction Engine',
  description: 'Mines the event log using association rule mining to propose deterministic auto-categorization rules from historically verified actions.',
  inputs: [
    { key: 'minSupport', label: 'Minimum Support (Occurrences)', min: 1, max: 20, step: 1, defaultValue: 3 },
    { key: 'minConfidence', label: 'Minimum Confidence (%)', min: 50, max: 100, step: 5, defaultValue: 85 }
  ],
  compute: (ctx, inputs) => {
    const { transactions } = ctx;
    const start = performance.now();
    // Check if there are explicitly verified transactions; if so, use them, otherwise evaluate all
    const explicitlyVerified = transactions.filter(t => t.verification?.status === 'verified');
    const targetDataset = explicitlyVerified.length >= inputs.minSupport ? explicitlyVerified : transactions.map(t => ({
        ...t, 
        verification: { status: 'verified' as const, method: 'manual' as const, hash: '', timestamp: '' }
    }));
    
    const rules = induceRules(targetDataset, inputs.minSupport, inputs.minConfidence / 100);
    const ms = performance.now() - start;

    return {
      metrics: [
        { label: 'Execution Time', value: `${ms.toFixed(2)} ms` },
        { label: 'Transactions Mined', value: transactions.length },
        { label: 'Rules Proposed', value: rules.length, color: 'text-emerald-400' }
      ],
      charts: [
         {
             data: rules.slice(0, 10).map(r => ({
                 name: r.condition, 
                 support: r.support,
                 confidence: Math.round(r.confidence * 100)
             })),
             config: {
                 xKey: 'name',
                 yKeys: [
                     { key: 'support', color: '#3b82f6', name: 'Support (Occurrences)', type: 'bar' },
                     { key: 'confidence', color: '#10b981', name: 'Confidence (%)', type: 'line' }
                 ]
             }
         }
      ],
      insights: [
        `Mined ${rules.length} strong deterministic rules using association rule mining.`,
        'These rules bridge the gap between opaque Bayesian guessing and strict deterministic execution.',
        rules[0] ? `Strongest rule: IF description contains "${rules[0].condition}" THEN classify as "${rules[0].targetAccount}" (Confidence: ${Math.round(rules[0].confidence*100)}%, Support: ${rules[0].support})` : 'No rules met the confidence threshold.'
      ]
    };
  }
};
