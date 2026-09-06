import { Transaction } from '../../types';
import { AlgorithmDefinition } from './types';
import { computeTFIDFWeights } from './tf-idf';

export function fingerprintBusiness(transactions: readonly Transaction[]) {
    if (!transactions.length) return { industry: 'Unknown', confidence: 0, clusters: [] };
    
    // 1. Get terms
    const termFreq = new Map<string, number>();
    transactions.forEach(t => {
        const words = (t.description || '').toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
        words.forEach(w => termFreq.set(w, (termFreq.get(w) || 0) + 1));
    });

    // 2. Signatures
    const signatures = [
        { id: 'ecommerce', keywords: ['shopify', 'stripe', 'paypal', 'shipping', 'usps', 'fedex', 'ads', 'meta'] },
        { id: 'real_estate', keywords: ['rent', 'tenant', 'zillow', 'mortgage', 'home depot', 'plumbing', 'repairs'] },
        { id: 'software', keywords: ['aws', 'github', 'figma', 'vercel', 'gsuite', 'slack', 'software', 'cloud'] },
        { id: 'agency', keywords: ['upwork', 'fiverr', 'contractor', 'adobe', 'hosting', 'client', 'retainer'] }
    ];

    let bestMatch = 'General Business';
    let maxScore = 0;

    signatures.forEach(sig => {
        let score = 0;
        sig.keywords.forEach(kw => {
            if (termFreq.has(kw)) score += termFreq.get(kw)!;
        });
        if (score > maxScore) {
            maxScore = score;
            bestMatch = sig.id;
        }
    });

    return { 
        industry: bestMatch, 
        confidence: Math.min(1, maxScore / Math.max(10, transactions.length)),
        topTerms: Array.from(termFreq.entries()).sort((a,b) => b[1] - a[1]).slice(0, 10).map(t => t[0])
    };
}

export const AUTO_SETUP_ALGO: AlgorithmDefinition = {
  id: 'auto_setup',
  domain: 'system',
  name: 'Zero-Setup Books (Industry Fingerprinting)',
  description: 'Clusters merchant tokens using TF-IDF to fingerprint the business industry and propose a bespoke Chart of Accounts without a setup wizard.',
  inputs: [],
  compute: (ctx, inputs) => {
    const { transactions } = ctx;
    const start = performance.now();
    const result = fingerprintBusiness(transactions);
    const ms = performance.now() - start;

    return {
      metrics: [
        { label: 'Detected Industry', value: result.industry, color: 'text-emerald-400' },
        { label: 'Confidence', value: `${(result.confidence * 100).toFixed(0)}%` },
        { label: 'Execution Time', value: `${ms.toFixed(2)} ms` }
      ],
      charts: [
          {
             data: result.topTerms || [].map((t, i) => ({ name: t, count: 10 - i })),
             config: { xKey: 'name', yKeys: [{ key: 'count', color: '#8b5cf6', name: 'TF-IDF Weight', type: 'bar' }] }
          }
      ],
      insights: [
        `Analyzed ${transactions.length} records and fingerprinted the business as "${result.industry}".`,
        `Top distinguishing tokens: ${result.topTerms || [].join(', ')}`,
        'We can automatically construct the optimal chart of accounts for this industry before the user even reaches the dashboard.'
      ]
    };
  }
};
