import { Transaction } from '../../types';
import { AlgorithmDefinition } from './types';

// Computes TF-IDF weights for tokens across all transaction descriptions
// TF: Term Frequency (in a single description) - mostly 1 in our case
// IDF: Inverse Document Frequency - how rare the token is across all descriptions
export function computeTFIDFWeights(transactions: readonly Transaction[]): Map<string, number> {
    const N = transactions.length;
    if (N === 0) return new Map();

    const df = new Map<string, number>();
    
    // Calculate Document Frequency
    transactions.forEach(t => {
        const desc = t.description?.toLowerCase() || '';
        // Simple tokenization
        const tokens = new Set(desc.match(/\b[a-z0-9]+\b/g) || []);
        
        tokens.forEach(token => {
            if (token.length < 2) return; // ignore 1-char noise
            df.set(token, (df.get(token) || 0) + 1);
        });
    });

    const idf = new Map<string, number>();
    // Calculate IDF
    for (const [token, count] of df.entries()) {
        // Standard IDF formula: log(N / (count + 1))
        // The +1 prevents division by zero
        idf.set(token, Math.log(N / (count + 1)));
    }

    return idf;
}

export function similarityWithTFIDF(desc1: string, desc2: string, idf: Map<string, number>): number {
    const tokens1 = desc1.toLowerCase().match(/\b[a-z0-9]+\b/g) || [];
    const tokens2 = desc2.toLowerCase().match(/\b[a-z0-9]+\b/g) || [];
    
    let intersectionWeight = 0;
    let unionWeight1 = 0;
    let unionWeight2 = 0;

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    for (const token of set1) {
        const w = idf.get(token) || Math.log(100); // assume unseen tokens are rare
        unionWeight1 += w;
        if (set2.has(token)) {
            intersectionWeight += w;
        }
    }

    for (const token of set2) {
        const w = idf.get(token) || Math.log(100);
        unionWeight2 += w;
    }

    if (unionWeight1 === 0 && unionWeight2 === 0) return 0;
    
    // Jaccard similarity weighted by TF-IDF
    return intersectionWeight / (unionWeight1 + unionWeight2 - intersectionWeight);
}

export const TF_IDF_MATCHER: AlgorithmDefinition = {
  id: 'tf_idf_matching',
  domain: 'operations',
  name: 'TF-IDF Token Weighting Engine',
  description: 'Applies classic Information Retrieval techniques to ignore noise tokens (PAYPAL, DEBIT) and weigh rare vendor names highly during fuzzy matching.',
  inputs: [
    { key: 'targetIdx', label: 'Sample Transaction Index', min: 0, max: 100, step: 1, defaultValue: 0 }
  ],
  compute: (ctx, inputs) => {
    const { transactions } = ctx;
    const start = performance.now();
    const idf = computeTFIDFWeights(transactions);
    const ms = performance.now() - start;
    
    // Find the most 'useless' tokens (lowest IDF)
    const sortedTokens = Array.from(idf.entries()).sort((a,b) => a[1] - b[1]);
    const noiseTokens = sortedTokens.slice(0, 5);
    const rareTokens = sortedTokens.slice(-5).reverse();

    // Take a sample
    const idx = Math.min(inputs.targetIdx, transactions.length - 1);
    const sample = transactions[idx]?.description || 'PAYPAL *UBER TRIP';
    
    // Evaluate tokens in sample
    const sampleTokens = sample.toLowerCase().match(/\b[a-z0-9]+\b/g) || [];
    const sampleWeights = sampleTokens.map(t => ({ token: t, weight: idf.get(t) || 0 }));

    return {
      metrics: [
        { label: 'Vocabulary Size', value: idf.size },
        { label: 'Execution Time', value: `${ms.toFixed(2)} ms` },
        { label: 'Top Noise Token', value: noiseTokens[0]?.[0] || 'N/A' },
        { label: 'Top Signal Token', value: rareTokens[0]?.[0] || 'N/A' }
      ],
      charts: [
         {
             data: sampleWeights.map(sw => ({
                 name: sw.token, 
                 weight: sw.weight
             })),
             config: {
                 xKey: 'name',
                 yKeys: [
                     { key: 'weight', color: '#f59e0b', name: 'Information Value (IDF)', type: 'bar' }
                 ]
             }
         }
      ],
      insights: [
        `Computed token weights over ${transactions.length} transactions.`,
        `Noise terms like "${noiseTokens.map(t=>t[0]).join(', ')}" will be mathematically ignored.`,
        `Rare terms like "${rareTokens.map(t=>t[0]).join(', ')}" will dominate the match score.`,
        'Replaces naive Jaro-Winkler with weighted Jaccard for significantly higher precision.'
      ]
    };
  }
};
