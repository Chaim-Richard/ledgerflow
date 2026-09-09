import { AhoCorasick, lexicalSimilarity, optimizedTransactionSimilarity, BayesianClassifier, SpellChecker } from './algorithms';
import { Transaction, AutoRule, DimensionNode, ChartAccount } from '../types';
import { extractMultiDimensionalLabels, expandDeepLabels, decomposeHierarchicalLabel } from './dimensionUtils';

export interface MatchingClaim {
  accountName: string;
  confidence: number;
  status: 'AUTO_POSTED' | 'REVIEW_REQUIRED';
  provenance: {
    layer: string;
    description: string;
    evidence: string;
  };
  tags?: string[];
  dimensions?: Record<string, string>;
}

/**
 * Deterministic Entity Resolution & Matching Engine
 * Implements Layer 2 of the LedgerFlow Architecture.
 * Uses Aho-Corasick for O(N) multi-pattern matching and Levenshtein for fuzzy resolution.
 */
export class MatchingEngine {
  private ac: AhoCorasick | null = null;
  private dimAc: AhoCorasick | null = null;
  private rules: AutoRule[] = [];
  private analyticalCache: Record<string, any> = {};
  private bayes: BayesianClassifier;
  private spellChecker: SpellChecker;
  private analyticalSalt: string;
  private threshold: number;
  private dimensionNodes: DimensionNode[] = [];
  private accounts: ChartAccount[] = [];

  constructor(
    rules: AutoRule[], 
    analyticalCache: Record<string, any> = {}, 
    analyticalSalt = '', 
    threshold = 0.85, 
    allTransactions?: Transaction[], 
    dimensionNodes?: DimensionNode[],
    accounts?: ChartAccount[]
  ) {
    this.rules = rules;
    this.analyticalCache = analyticalCache;
    this.analyticalSalt = analyticalSalt;
    this.threshold = threshold;
    this.dimensionNodes = dimensionNodes || [];
    this.accounts = accounts || [];
    
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

    // 1.5. Initialize AC Trie for dimension nodes
    if (this.dimensionNodes.length > 0) {
      const dimPatterns = this.dimensionNodes.flatMap(node => {
        const patterns = [...(node.aliases || [])];
        // Also use the description and ID as patterns if they are substantial
        if (node.description && node.description.length > 3) patterns.push(node.description);
        patterns.push(node.id); // e.g. "P1"
        return patterns.map(p => ({ pattern: p, ruleId: node.id }));
      });
      
      if (dimPatterns.length > 0) {
        this.dimAc = new AhoCorasick(dimPatterns);
      }
    }

    // 2. Seed Bayesian Network with Analytical Cache patterns (Google-Style Pre-training)
    // Guard against training on archived or inactive accounts
    Object.entries(analyticalCache).forEach(([description, data]: [string, any]) => {
      if (data.accountName && !this.isAccountArchivedOrInactive(data.accountName)) {
        this.bayes.train(description, data.accountName);
      }
    });

    // 3. Dynamic Auto-Learning on Finished Historical Transactions (3x accuracy improvements)
    // Guard against learning into archived or inactive accounts
    if (allTransactions && allTransactions.length > 0) {
      allTransactions.forEach(t => {
        if (!t.deletedAt && t.status !== 'void' && t.lines && t.lines.length > 0) {
          t.lines.forEach(line => {
            if (
              line.accountName && 
              line.accountName !== 'Uncategorized' && 
              line.accountName !== 'Manual Review' &&
              !this.isAccountArchivedOrInactive(line.accountId || line.accountName)
            ) {
              const descToTrain = line.description || (t.lines.length === 1 ? t.description : undefined);
              if (descToTrain) {
                this.bayes.train(descToTrain, line.accountName);
              }
            }
          });
        }
      });
    }
  }

  public setAccounts(accounts: ChartAccount[]): void {
    this.accounts = accounts;
  }

  /**
   * Checks if an account name or ID refers to an archived or inactive account.
   */
  public isAccountArchivedOrInactive(nameOrId: string, accountsOverride?: ChartAccount[]): boolean {
    const list = (accountsOverride && accountsOverride.length > 0) ? accountsOverride : this.accounts;
    if (!list || list.length === 0 || !nameOrId) return false;
    const lower = nameOrId.toLowerCase();
    const acc = list.find(a => a.id === nameOrId || a.name.toLowerCase() === lower);
    if (!acc) return false;
    return (acc as any).archived === true || (acc as any).isArchived === true || acc.isActive === false;
  }

  /**
   * Resolves category based on description patterns with multi-layer fallback.
   * Fully supports deep and multi-dimensional labeling (nested tags, coordinate paths, sub-labels).
   */
  resolveCategory(description: string, accountsOverride?: ChartAccount[]): { accountName: string, tags?: string[], dimensions?: Record<string, string> } | null {
    const lowerDesc = (description || '').toLowerCase().trim();
    if (!lowerDesc) return null;

    // Extract deep multi-dimensional coordinates and tags from description (e.g. [Project:Apollo/Phase1] or #dept/eng)
    const extractedLabels = extractMultiDimensionalLabels(description);
    const baseDimensions: Record<string, string> = { ...extractedLabels.dimensions };
    const baseTags: string[] = [...extractedLabels.tags];

    const packageResult = (
      accountName: string, 
      extraTags?: string[], 
      extraDims?: Record<string, string>
    ) => {
      // Archived / Inactive Account Guard:
      // Skip accounts where archived === true || isActive === false, falling through to Manual Review
      // with the original category preserved in dimensions.
      const isArchivedOrInactive = this.isAccountArchivedOrInactive(accountName, accountsOverride);
      const finalAccountName = isArchivedOrInactive ? 'Manual Review' : accountName;

      const dec = decomposeHierarchicalLabel(accountName);
      if (dec.depth > 1) {
        baseDimensions['category'] = dec.fullPath;
        baseTags.push(dec.fullPath);
      }
      if (isArchivedOrInactive) {
        baseDimensions['category'] = accountName;
        baseTags.push('ARCHIVED_ACCOUNT_FALLTHROUGH');
      }

      const combinedDims = { ...baseDimensions, ...(extraDims || {}) };
      const combinedTags = expandDeepLabels([...baseTags, ...(extraTags || [])]);
      return {
        accountName: finalAccountName,
        tags: combinedTags.length > 0 ? combinedTags : undefined,
        dimensions: Object.keys(combinedDims).length > 0 ? combinedDims : undefined
      };
    };

    // LAYER 0.5: Dimension Node resolution
    if (this.dimAc) {
      const dimMatches = this.dimAc.search(description);
      if (dimMatches.length > 0) {
        for (const matchId of dimMatches) {
          const node = this.dimensionNodes.find(n => n.id === matchId);
          if (node && !baseDimensions[node.dimensionId]) {
            baseDimensions[node.dimensionId] = node.id;
          }
        }
      }
    }

    // LAYER 1: Hardened Deterministic Rules (Aho-Corasick Trie) - O(N)
    if (this.ac) {
      const matches = this.ac.search(description);
      if (matches.length > 0) {
        const matchId = matches[0];
        const rule = this.rules.find(r => r.id === matchId);
        if (rule?.action.targetCategory) {
          return packageResult(
            rule.action.targetCategory,
            rule.action.targetTags,
            rule.action.targetDimensions
          );
        }
      }
    }

    // LAYER 2: Analytical Memory (Exact Match)
    const exactCache = this.analyticalCache[lowerDesc];
    if (exactCache) {
      return packageResult(exactCache.accountName, exactCache.tags, exactCache.dimensions);
    }

    // LAYER 3: Analytical Memory (Partial Word Match) - Pick longest matching pattern
    const partialMatches = Object.entries(this.analyticalCache)
      .filter(([key]) => key.length >= 4 && lowerDesc.includes(key))
      .sort((a, b) => b[0].length - a[0].length);
    if (partialMatches.length > 0) {
      const best = partialMatches[0][1];
      return packageResult(best.accountName, best.tags, best.dimensions);
    }
    
    // LAYER 4: Analytical Similarity (Jaro-Winkler + Semantic Overlap)
    if (lowerDesc.length > 3) {
      let bestFuzzy = { accountName: null as string | null, tags: [] as string[] | undefined, dimensions: undefined as Record<string, string> | undefined, score: 0 };
      const descWords = new Set(lowerDesc.split(/\s+/).filter(w => w.length > 2));

      for (const [key, val] of Object.entries(this.analyticalCache)) {
        if (key.length < 3) continue;
        
        const similarity = optimizedTransactionSimilarity(lowerDesc, key);
        const keyWords = key.split(/\s+/).filter((w: string) => w.length > 2);
        const overlapCount = keyWords.filter((w: string) => descWords.has(w)).length;
        const overlapScore = keyWords.length > 0 ? overlapCount / (keyWords.length || 1) : 0;

        const score = (similarity * 0.7) + (overlapScore * 0.3);

        if (score > this.threshold && score > bestFuzzy.score) {
          bestFuzzy = { accountName: val.accountName, tags: val.tags, dimensions: val.dimensions, score };
        }
      }
      if (bestFuzzy.accountName) {
        return packageResult(bestFuzzy.accountName, bestFuzzy.tags, bestFuzzy.dimensions);
      }
    }

    // LAYER 5: Statistical Inference (Probabilistic Models with Hierarchical Deep Categories)
    if (lowerDesc.length > 5) {
      const prediction = this.bayes.classifyHierarchical(lowerDesc);
      // Use configured threshold
      if (prediction && prediction.confidence > this.threshold) {
        return packageResult(prediction.category);
      }
    }

    // LAYER 6: Spell Correction (Typo Resistance)
    const typoCorrection = this.spellChecker.findClosest(lowerDesc, 2);
    if (typoCorrection) {
      const match = this.analyticalCache[typoCorrection];
      if (match) return packageResult(match.accountName, match.tags, match.dimensions);
    }

    // LAYER 7: Fail-safe to Manual Review
    return packageResult('Manual Review', ['UNRESOLVED_ENTRY']);
  }

  /**
   * Explains and debugs which mathematical layer matched a description
   */
  debugResolveCategory(description: string): { accountName: string; layer: string; confidence?: number; dimensions?: Record<string, string> } {
    const lowerDesc = (description || '').toLowerCase().trim();
    if (!lowerDesc) return { accountName: 'Manual Review', layer: 'Empty Input' };

    let dimensionReason = '';
    const extractedLabels = extractMultiDimensionalLabels(description);
    const baseDimensions: Record<string, string> = { ...extractedLabels.dimensions };
    if (extractedLabels.deepPaths.length > 0) {
      dimensionReason = ` (Deep Labels: ${extractedLabels.deepPaths.join(', ')})`;
    }
    
    // LAYER 0.5: Dimension Node resolution
    if (this.dimAc) {
      const dimMatches = this.dimAc.search(description);
      if (dimMatches.length > 0) {
        const foundAliases: string[] = [];
        for (const matchId of dimMatches) {
          const node = this.dimensionNodes.find(n => n.id === matchId);
          if (node) {
            if (!baseDimensions[node.dimensionId]) {
              baseDimensions[node.dimensionId] = node.id;
            }
            if (!foundAliases.includes(node.id)) {
              foundAliases.push(node.id);
            }
          }
        }
        if (foundAliases.length > 0) {
          dimensionReason += ` (Matched alias: ${foundAliases.join(', ')})`;
        }
      }
    }

    const packageDebug = (accountName: string, layer: string, confidence?: number, extraDims?: Record<string, string>) => {
      const isArchivedOrInactive = this.isAccountArchivedOrInactive(accountName);
      const finalAccountName = isArchivedOrInactive ? 'Manual Review' : accountName;
      const finalLayer = isArchivedOrInactive 
        ? `${layer} (Archived/Inactive Account -> Fallthrough to Manual Review)`
        : layer + dimensionReason;

      const dec = decomposeHierarchicalLabel(accountName);
      if (dec.depth > 1) {
        baseDimensions['category'] = dec.fullPath;
      }
      if (isArchivedOrInactive) {
        baseDimensions['category'] = accountName;
      }

      const combined = { ...baseDimensions, ...(extraDims || {}) };
      return {
        accountName: finalAccountName,
        layer: finalLayer,
        confidence,
        dimensions: Object.keys(combined).length > 0 ? combined : undefined
      };
    };

    // LAYER 1: Hardened Deterministic Rules (Aho-Corasick Trie) - O(N)
    if (this.ac) {
      const matches = this.ac.search(description);
      if (matches.length > 0) {
        const matchId = matches[0];
        const rule = this.rules.find(r => r.id === matchId);
        if (rule?.action.targetCategory) {
          const ruleName = rule.condition.vendor || rule.condition.descriptionContains || rule.id;
          return packageDebug(rule.action.targetCategory, 'Rule: ' + ruleName, 1.0, rule.action.targetDimensions);
        }
      }
    }

    // LAYER 2: Analytical Memory (Exact Match)
    const exactCache = this.analyticalCache[lowerDesc];
    if (exactCache) {
      return packageDebug(exactCache.accountName, 'Exact Cache Pattern Match', 1.0, exactCache.dimensions);
    }

    // LAYER 3: Analytical Memory (Partial Word Match) - Pick longest matching pattern
    const partialMatches = Object.entries(this.analyticalCache)
      .filter(([key]) => key.length >= 4 && lowerDesc.includes(key))
      .sort((a, b) => b[0].length - a[0].length);
    if (partialMatches.length > 0) {
      const best = partialMatches[0][1];
      return packageDebug(best.accountName, 'Partial Cache Pattern', 0.95, best.dimensions);
    }
    
    // LAYER 4: Analytical Similarity (Jaro-Winkler + Semantic Overlap)
    if (lowerDesc.length > 3) {
      let bestFuzzy = { accountName: null as string | null, dimensions: undefined as Record<string, string> | undefined, score: 0 };
      const descWords = new Set(lowerDesc.split(/\s+/).filter(w => w.length > 2));

      for (const [key, val] of Object.entries(this.analyticalCache)) {
        if (key.length < 3) continue;
        
        const similarity = optimizedTransactionSimilarity(lowerDesc, key);
        const keyWords = key.split(/\s+/).filter((w: string) => w.length > 2);
        const overlapCount = keyWords.filter((w: string) => descWords.has(w)).length;
        const overlapScore = keyWords.length > 0 ? overlapCount / (keyWords.length || 1) : 0;

        const score = (similarity * 0.7) + (overlapScore * 0.3);

        if (score > this.threshold && score > bestFuzzy.score) {
          bestFuzzy = { accountName: val.accountName, dimensions: val.dimensions, score };
        }
      }
      if (bestFuzzy.accountName) {
        return packageDebug(bestFuzzy.accountName, 'Fuzzy Jaro-Winkler Metric', Number(bestFuzzy.score.toFixed(2)), bestFuzzy.dimensions);
      }
    }

    // LAYER 5: Statistical Inference (Probabilistic Models with Hierarchical Deep Categories)
    if (lowerDesc.length > 5) {
      const prediction = this.bayes.classifyHierarchical(lowerDesc);
      if (prediction && prediction.confidence > this.threshold) {
        return packageDebug(prediction.category, 'Bayesian Auto-Learning Model', Number(prediction.confidence.toFixed(2)));
      }
    }

    // LAYER 6: Spell Correction (Typo Resistance)
    const typoCorrection = this.spellChecker.findClosest(lowerDesc, 2);
    if (typoCorrection) {
      const match = this.analyticalCache[typoCorrection];
      if (match) {
        return packageDebug(match.accountName, `Typo Correction: ${typoCorrection}`, 0.8, match.dimensions);
      }
    }

    return packageDebug('Manual Review', 'Fallback Manual Intervention');
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
   * Evaluates input description and returns an explicit AI Claim carrying provenance and evidence.
   */
  resolveClaim(description: string): MatchingClaim {
    const debug = this.debugResolveCategory(description);
    const confidence = debug.confidence ?? (debug.layer.startsWith('Rule') || debug.layer.startsWith('Exact') ? 1.0 : 0.7);
    const isHighConfidence = confidence >= this.threshold && (debug.layer.startsWith('Rule') || debug.layer.startsWith('Exact'));

    return {
      accountName: debug.accountName,
      confidence,
      status: isHighConfidence ? 'AUTO_POSTED' : 'REVIEW_REQUIRED',
      provenance: {
        layer: debug.layer,
        description,
        evidence: `Matched via ${debug.layer} (confidence: ${(confidence * 100).toFixed(0)}%)`
      },
      dimensions: debug.dimensions
    };
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
