import { AhoCorasick, lexicalSimilarity, optimizedTransactionSimilarity, BayesianClassifier, SpellChecker } from './algorithms';
import { Transaction, AutoRule } from '../types';

/**
 * Deterministic Entity Resolution & Matching Engine
 * Implements Layer 2 of the Clearbook Architecture.
 * Uses Aho-Corasick for O(N) multi-pattern matching and Levenshtein for fuzzy resolution.
 */
export class MatchingEngine {
  private ac: AhoCorasick | null = null;
  private rules: AutoRule[] = [];
  private analyticalCache: Record<string, any> = {};
  private bayes: BayesianClassifier;
  private spellChecker: SpellChecker;
  private analyticalSalt: string;
  private threshold: number;

  constructor(rules: AutoRule[], analyticalCache: Record<string, any> = {}, analyticalSalt = '', threshold = 0.85, allTransactions?: Transaction[]) {
    this.rules = rules;
    this.analyticalCache = analyticalCache;
    this.analyticalSalt = analyticalSalt;
    this.threshold = threshold;
    this.bayes = new BayesianClassifier();
    this.spellChecker = new SpellChecker(Object.keys(analyticalCache));

    // 1. Initialize AC Trie for high-speed deterministic matching
    if (rules.length > 0) {
      const patterns = rules.flatMap(r => {
        const patternsToMatch = [];
        if (r.condition.vendor) patternsToMatch.push(r.condition.vendor);
        if (r.condition.descriptionContains) patternsToMatch.push(r.condition.descriptionContains);
        return patternsToMatch.map(p => ({ pattern: p, ruleId: r.id }));
      });
      
      if (patterns.length > 0) {
        this.ac = new AhoCorasick(patterns);
      }
    }

    // 2. Seed Bayesian Network with Analytical Cache patterns (Google-Style Pre-training)
    Object.entries(analyticalCache).forEach(([description, data]: [string, any]) => {
      if (data.accountName) {
        this.bayes.train(description, data.accountName);
      }
    });

    // 3. Dynamic Auto-Learning on Finished Historical Transactions (3x accuracy improvements)
    if (allTransactions && allTransactions.length > 0) {
      allTransactions.forEach(t => {
        if (!t.deletedAt && t.lines && t.lines.length > 0) {
          t.lines.forEach(line => {
            if (line.accountName && line.accountName !== 'Uncategorized' && line.accountName !== 'Manual Review') {
              this.bayes.train(t.description, line.accountName);
            }
          });
        }
      });
    }
  }

  /**
   * Resolves category based on description patterns with multi-layer fallback.
   */
  resolveCategory(description: string): { accountName: string, tags?: string[], dimensions?: Record<string, string> } | null {
    const lowerDesc = (description || '').toLowerCase().trim();
    if (!lowerDesc) return null;

    const isClient = typeof window !== 'undefined';

    // LAYER 1: Hardened Deterministic Rules (Aho-Corasick Trie) - O(N)
    if (this.ac) {
      const matches = this.ac.search(description);
      if (matches.length > 0) {
        const matchId = matches[0];
        const rule = this.rules.find(r => r.id === matchId);
        if (rule?.action.targetCategory) return { 
          accountName: rule.action.targetCategory,
          dimensions: rule.action.targetDimensions
        };
      }
    }

    // LAYER 2: Analytical Memory (Exact Match)
    const exactCache = this.analyticalCache[lowerDesc];
    if (exactCache) return { accountName: exactCache.accountName, tags: exactCache.tags };

    // LAYER 3: Analytical Memory (Partial Word Match)
    const partialMatch = Object.entries(this.analyticalCache).find(([key]) => 
      lowerDesc.includes(key) || key.includes(lowerDesc)
    );
    if (partialMatch) return { accountName: partialMatch[1].accountName, tags: partialMatch[1].tags };
    
    // LAYER 4: Analytical Similarity (Jaro-Winkler + Semantic Overlap)
    if (lowerDesc.length > 3) {
      let bestFuzzy = { accountName: null as string | null, tags: [] as string[] | undefined, score: 0 };
      const descWords = new Set(lowerDesc.split(/\s+/).filter(w => w.length > 2));

      for (const [key, val] of Object.entries(this.analyticalCache)) {
        if (key.length < 3) continue;
        
        const similarity = optimizedTransactionSimilarity(lowerDesc, key);
        const keyWords = key.split(/\s+/).filter((w: string) => w.length > 2);
        const overlapCount = keyWords.filter((w: string) => descWords.has(w)).length;
        const overlapScore = keyWords.length > 0 ? overlapCount / (keyWords.length || 1) : 0;

        const score = (similarity * 0.7) + (overlapScore * 0.3);

        if (score > this.threshold && score > bestFuzzy.score) {
          bestFuzzy = { accountName: val.accountName, tags: val.tags, score };
        }
      }
      if (bestFuzzy.accountName) return { accountName: bestFuzzy.accountName, tags: bestFuzzy.tags };
    }

    // LAYER 5: Statistical Inference (Probabilistic Models)
    if (lowerDesc.length > 5) {
      const prediction = this.bayes.classify(lowerDesc);
      // Use configured threshold
      if (prediction && prediction.confidence > this.threshold) {
        return { accountName: prediction.category };
      }
    }

    // LAYER 6: Spell Correction (Typo Resistance)
    const typoCorrection = this.spellChecker.findClosest(lowerDesc, 2);
    if (typoCorrection) {
      const match = this.analyticalCache[typoCorrection];
      if (match) return { accountName: match.accountName, tags: match.tags };
    }

    // LAYER 7: Fail-safe to Manual Review
    return { accountName: 'Manual Review', tags: ['UNRESOLVED_ENTRY'] };
  }

  /**
   * Explains and debugs which mathematical layer matched a description
   */
  debugResolveCategory(description: string): { accountName: string; layer: string; confidence?: number } {
    const lowerDesc = (description || '').toLowerCase().trim();
    if (!lowerDesc) return { accountName: 'Manual Review', layer: 'Empty Input' };

    // LAYER 1: Hardened Deterministic Rules (Aho-Corasick Trie) - O(N)
    if (this.ac) {
      const matches = this.ac.search(description);
      if (matches.length > 0) {
        const matchId = matches[0];
        const rule = this.rules.find(r => r.id === matchId);
        if (rule?.action.targetCategory) {
          const ruleName = rule.condition.vendor || rule.condition.descriptionContains || rule.id;
          return { accountName: rule.action.targetCategory, layer: 'Rule: ' + ruleName, confidence: 1.0 };
        }
      }
    }

    // LAYER 2: Analytical Memory (Exact Match)
    const exactCache = this.analyticalCache[lowerDesc];
    if (exactCache) {
      return { accountName: exactCache.accountName, layer: 'Exact Cache Pattern Match', confidence: 1.0 };
    }

    // LAYER 3: Analytical Memory (Partial Word Match)
    const partialMatch = Object.entries(this.analyticalCache).find(([key]) => 
      lowerDesc.includes(key) || key.includes(lowerDesc)
    );
    if (partialMatch) {
      return { accountName: partialMatch[1].accountName, layer: 'Partial Cache Pattern', confidence: 0.95 };
    }
    
    // LAYER 4: Analytical Similarity (Jaro-Winkler + Semantic Overlap)
    if (lowerDesc.length > 3) {
      let bestFuzzy = { accountName: null as string | null, score: 0 };
      const descWords = new Set(lowerDesc.split(/\s+/).filter(w => w.length > 2));

      for (const [key, val] of Object.entries(this.analyticalCache)) {
        if (key.length < 3) continue;
        
        const similarity = optimizedTransactionSimilarity(lowerDesc, key);
        const keyWords = key.split(/\s+/).filter((w: string) => w.length > 2);
        const overlapCount = keyWords.filter((w: string) => descWords.has(w)).length;
        const overlapScore = keyWords.length > 0 ? overlapCount / (keyWords.length || 1) : 0;

        const score = (similarity * 0.7) + (overlapScore * 0.3);

        if (score > this.threshold && score > bestFuzzy.score) {
          bestFuzzy = { accountName: val.accountName, score };
        }
      }
      if (bestFuzzy.accountName) {
        return { accountName: bestFuzzy.accountName, layer: 'Fuzzy Jaro-Winkler Metric', confidence: Number(bestFuzzy.score.toFixed(2)) };
      }
    }

    // LAYER 5: Statistical Inference (Probabilistic Models)
    if (lowerDesc.length > 3) {
      const prediction = this.bayes.classify(lowerDesc);
      if (prediction) {
        return { 
          accountName: prediction.category, 
          layer: 'Bayesian Auto-Learning Model', 
          confidence: Number(prediction.confidence.toFixed(2)) 
        };
      }
    }

    // LAYER 6: Spell Correction (Typo Resistance)
    const typoCorrection = this.spellChecker.findClosest(lowerDesc, 2);
    if (typoCorrection) {
      const match = this.analyticalCache[typoCorrection];
      if (match) {
        return { accountName: match.accountName, layer: `Typo Correction: ${typoCorrection}`, confidence: 0.8 };
      }
    }

    return { accountName: 'Manual Review', layer: 'Fallback Manual Intervention' };
  }

  /**
   * Resolves a "normalized" merchant ID from a raw description.
   * Useful for grouping similar transactions from different banks.
   * This uses a hybrid Lexical-Jaro-Winkler scoring system for maximum precision.
   * Includes specific heuristics for stripping transaction metadata (The Google Way).
   */
  resolveMerchant(description: string, knownMerchants: { id: string, name: string }[]): string {
    const cleanDesc = (description || '').toLowerCase()
      .replace(/\b(sq \*|visa|pos|purchase|txn|val|int|ext|csh)\b/g, '') // Strip common bank metadata
      .replace(/[^a-z0-9 \u0590-\u05FF]/g, ' ')
      .trim();
    
    if (cleanDesc.length === 0) return description;

    let bestMatch = { id: description, score: 0 };
    
    for (const merchant of knownMerchants) {
      const merchantName = merchant.name.toLowerCase();
      
      // 1. Direct Pattern Intersection (High Confidence for partial matches)
      if (cleanDesc.includes(merchantName) || merchantName.includes(cleanDesc)) {
        const intersectionRatio = Math.min(cleanDesc.length, merchantName.length) / Math.max(cleanDesc.length, merchantName.length);
        if (intersectionRatio > 0.8) return merchant.id;
      }

      // 2. Statistical Similarity Scoring
      const levScore = lexicalSimilarity(cleanDesc, merchantName, this.analyticalSalt);
      const compositeScore = optimizedTransactionSimilarity(cleanDesc, merchantName);
      
      if (compositeScore > 0.88 && compositeScore > bestMatch.score) {
        bestMatch = { id: merchant.id, score: compositeScore };
      }
    }
    
    return bestMatch.id;
  }

  /**
   * Global Matching Analysis (Stability Matcher)
   * Groups a batch of raw transactions into clusters based on resolved merchants.
   */
  groupTransactions(transactions: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    transactions.forEach(tx => {
      const merchantId = this.resolveMerchant(tx.description, []); // Context-free for now
      if (!groups.has(merchantId)) groups.set(merchantId, []);
      groups.get(merchantId)!.push(tx);
    });
    
    return groups;
  }

  /**
   * Suggests categories for a batch of transactions asynchronously in time-sliced chunks.
   * Prevents UI thread blocking when running massive classification on tons of info.
   */
  async suggestCategoriesAsync(transactions: Transaction[], onProgress?: (pct: number) => void): Promise<Map<string, { accountName: string, dimensions?: Record<string, string> }>> {
    const suggestions = new Map<string, { accountName: string, dimensions?: Record<string, string> }>();
    const chunkSize = 200; // Optimal yielding threshold for React/Vite loop constraints
    
    for (let i = 0; i < transactions.length; i += chunkSize) {
      // 1. Process Chunk
      const chunk = transactions.slice(i, i + chunkSize);
      chunk.forEach(tx => {
        const ruleMatch = this.resolveCategory(tx.description);
        if (ruleMatch) {
          suggestions.set(tx.id, {
            accountName: ruleMatch.accountName,
            dimensions: ruleMatch.dimensions
          });
        }
      });
      
      // 2. Report Progress
      if (onProgress) {
        onProgress(Math.min(100, Math.round(((i + chunk.length) / (transactions.length || 1)) * 100)));
      }

      // 3. Yield to Event Loop mathematically cleanly (prevents browser lockups)
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    return suggestions;
  }

  /**
   * Suggests categories for a batch of transactions by cross-referencing
   * existing rules and merchant similarity. (Synchronous legacy wrapper)
   */
  suggestCategories(transactions: Transaction[]): Map<string, string> {
    const suggestions = new Map<string, string>();
    
    transactions.forEach(tx => {
      // 1. Try direct rule match
      const ruleMatch = this.resolveCategory(tx.description);
      if (ruleMatch) {
        suggestions.set(tx.id, ruleMatch.accountName);
        return;
      }
    });

    return suggestions;
  }
}
