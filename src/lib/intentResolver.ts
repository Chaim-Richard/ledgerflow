import { format, startOfMonth, endOfMonth, startOfYear, subMonths, subDays } from 'date-fns';
import { TruthEngine } from '../modules/integrity/TruthEngine';

export const PATTERNS = {
  OP: /([><=])\s*([\d,]+(\.\d+)?)/,
  TEXT_OP: /(greater than|more than|over|above|at least|at most|less than|under|below|around|about|approx|approximately)\s*([\d,]+(\.\d+)?)/,
  RANGE: /between\s*([\d,]+(\.\d+)?)\s*and\s*([\d,]+(\.\d+)?)/,
  PERCENTILE: /\b(top|bottom)\s*(10|25|50)\s*%?\b/,
  MONTH: /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/,
  YEAR: /\b(20\d{2})\b/,
  RELATIVE: /\b(last (?:month|week|year)|this (?:month|week|year)|yesterday|today|last \d+ days|ytd)\b/,
  QUARTER: /\b(q[1-4])\b/,
  DATE_RANGE: /(\d{4}-\d{2}-\d{2})\s*(?:to|until|through|-)\s*(\d{4}-\d{2}-\d{2})/,
  CATEGORY: /(category|type|account|sector):\s*([a-zA-Z\s]+)/,
  PROJECT: /(project|initiative|tag|venture):\s*([a-zA-Z\s]+)/,
  ERROR: /\b(error|mismatch|conflict|audit|review|unbalanced|weird|anomaly|fix)\b/,
};

const SEMANTIC_MAP: Record<string, string[]> = {
  'revenue': ['income', 'sales', 'earnings', 'deposits', 'inflow'],
  'expense': ['burn', 'spending', 'costs', 'bills', 'outflow', 'payments'],
  'marketing': ['ads', 'growth', 'social', 'campaign'],
  'infrastructure': ['cloud', 'aws', 'server', 'hosting', 'compute'],
  'payroll': ['salary', 'wages', 'team', 'staff', 'compensation', 'payroll'],
  'tax': ['irs', 'levy', 'tax', 'deductible', 'vat', 'gst'],
  'travel': ['uber', 'flight', 'airline', 'hotel', 'airbnb', 'commute'],
};

export interface ResolvedIntent {
  searchTerm: string;
  category?: string;
  project?: string;
  minAmountCents?: number;
  maxAmountCents?: number;
  startDate?: string;
  endDate?: string;
  percentile?: { side: 'top' | 'bottom', value: number };
  isAuditQuery?: boolean;
}

export class IntentResolver {
  static resolve(query: string, categories: string[] = [], projects: string[] = []): ResolvedIntent {
    const lowerQuery = query.toLowerCase().trim();
    const result: ResolvedIntent = { searchTerm: query };

    // 1. Semantic Mapping & Intent Steering
    for (const [canonical, aliases] of Object.entries(SEMANTIC_MAP)) {
      if (aliases.some(a => lowerQuery.includes(a)) || lowerQuery.includes(canonical)) {
          // If the query mentions a broad category like "expense", we often don't want to 
          // force a single category yet, but we allow the search term to capture it.
      }
    }

    // 2. Fuzzy Entity Detection (Smart Matching)
    const findEntity = (entities: string[], query: string) => {
        // Direct containment check (greedy)
        const direct = entities.find(e => query.includes(e.toLowerCase()));
        if (direct) return direct;

        // Sub-word check (e.g. "advertising" matches "ads")
        const sub = entities.find(e => e.split(' ').some(word => word.length > 3 && query.includes(word.toLowerCase())));
        return sub;
    };

    result.category = findEntity(categories, lowerQuery);
    result.project = findEntity(projects, lowerQuery);

    // 3. Precision Pattern Extraction
    const parseAmt = (valStr: string) => {
        let val = TruthEngine.parseAmountToCents(valStr) / 100;
        if (lowerQuery.includes('grand') || lowerQuery.includes('thousand') || lowerQuery.includes(' k ')) val *= 1000;
        if (lowerQuery.includes('mil') || lowerQuery.includes('million') || lowerQuery.includes(' m ')) val *= 1000000;
        return val * 100;
    };

    const opMatch = lowerQuery.match(/([><=])\s*([\d,]+(\.\d+)?)/);
    const textOpMatch = lowerQuery.match(/(greater than|more than|over|above|at least|at most|less than|under|below|around|about|approx|approximately)\s*([\d,]+(\.\d+)?)/);
    const rangeMatch = lowerQuery.match(/between\s*([\d,]+(\.\d+)?)\s*and\s*([\d,]+(\.\d+)?)/);

    if (opMatch) {
        const val = parseAmt(opMatch[2]);
        if (opMatch[1] === '>') result.minAmountCents = val;
        else if (opMatch[1] === '<') result.maxAmountCents = val;
    } else if (textOpMatch) {
        const val = parseAmt(textOpMatch[2]);
        const phrase = textOpMatch[1];
        if (/greater|more|over|above|at least/.test(phrase)) result.minAmountCents = val;
        else if (/less|under|below|at most/.test(phrase)) result.maxAmountCents = val;
    } else if (rangeMatch) {
        result.minAmountCents = parseAmt(rangeMatch[1]);
        result.maxAmountCents = parseAmt(rangeMatch[4]);
    }

    // 4. Enhanced Temporal Logic
    const monthMatch = lowerQuery.match(PATTERNS.MONTH);
    const yearMatch = lowerQuery.match(PATTERNS.YEAR);
    const relativeTimeMatch = lowerQuery.match(PATTERNS.RELATIVE);
    const quarterMatch = lowerQuery.match(PATTERNS.QUARTER);
    const dateRangeMatch = lowerQuery.match(PATTERNS.DATE_RANGE);
    const now = new Date();

    if (dateRangeMatch) {
        result.startDate = dateRangeMatch[1];
        result.endDate = dateRangeMatch[2];
    } else if (monthMatch) {
        const mNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const monthIdx = mNames.indexOf(monthMatch[1].toLowerCase()) % 12;
        const year = yearMatch ? parseInt(yearMatch[1]) : now.getFullYear();
        result.startDate = format(new Date(year, monthIdx, 1), 'yyyy-MM-dd');
        result.endDate = format(new Date(year, monthIdx + 1, 0), 'yyyy-MM-dd');
    } else if (relativeTimeMatch) {
        const rel = relativeTimeMatch[1].toLowerCase();
        if (rel.includes('last 7 days')) {
          result.startDate = format(subDays(now, 7), 'yyyy-MM-dd');
          result.endDate = format(now, 'yyyy-MM-dd');
        } else if (rel.includes('last 30 days')) {
          result.startDate = format(subDays(now, 30), 'yyyy-MM-dd');
          result.endDate = format(now, 'yyyy-MM-dd');
        } else if (rel === 'this month') {
          result.startDate = format(startOfMonth(now), 'yyyy-MM-dd');
          result.endDate = format(endOfMonth(now), 'yyyy-MM-dd');
        } else if (rel === 'last month') {
          const lm = subMonths(now, 1);
          result.startDate = format(startOfMonth(lm), 'yyyy-MM-dd');
          result.endDate = format(endOfMonth(lm), 'yyyy-MM-dd');
        } else if (rel === 'ytd') {
          result.startDate = format(startOfYear(now), 'yyyy-MM-dd');
          result.endDate = format(now, 'yyyy-MM-dd');
        }
    } else if (yearMatch && !monthMatch) {
        const year = parseInt(yearMatch[1]);
        result.startDate = `${year}-01-01`;
        result.endDate = `${year}-12-31`;
    }

    if (lowerQuery.match(PATTERNS.ERROR)) result.isAuditQuery = true;

    return result;
  }

  static resolveEntry(input: string, options?: { rules?: any[], accounts?: any[], ruleCache?: Record<string, any> }): any[] | null {
    const lines = input.split(/\n+/).filter(line => line.trim().length > 0);
    const results: any[] = [];

    for (const line of lines) {
        const lowerInput = line.toLowerCase().trim();
        let learnedCategory: string | null = null;
        const learnedAccount: string | null = null;
        let isRuleConfirmed = false;

        // 0. High-Confidence Rule Mapping (Hardened User Rules)
        if (options?.rules) {
            const matchingRule = options.rules.find(r => 
                (r.condition.descriptionContains && lowerInput.includes(r.condition.descriptionContains.toLowerCase())) ||
                (r.condition.vendor && lowerInput.includes(r.condition.vendor.toLowerCase()))
            );

            if (matchingRule) {
                learnedCategory = matchingRule.action.targetCategory || null;
                isRuleConfirmed = true;
            }
        }

        // 0.1 Autonomous Rule Cache (Soft Learning from History)
        if (!learnedCategory && options?.ruleCache) {
            const cacheMatch = Object.entries(options.ruleCache).find(([key]) => lowerInput.includes(key));
            if (cacheMatch) {
                learnedCategory = cacheMatch[1].accountName;
                isRuleConfirmed = true; // Still counts as learned, but soft
            }
        }
        
        // 1. Check for Split Patterns: "Walmart $100 ($40 Groceries, $60 Electronics)"
        const splitMatch = lowerInput.match(/([a-zA-Z0-9\s.]+)\s*\$?([\d,]+(?:\.\d+)?[km]?)\s*\(([^)]+)\)/i);
        
        if (splitMatch) {
            const store = splitMatch[1].trim();
            const totalAmtStr = splitMatch[2];
            const itemsStr = splitMatch[3];
            
            const cleanedAmtStr = totalAmtStr.replace(/[km]/i, '');
            let totalAmt = TruthEngine.parseAmountToCents(cleanedAmtStr) / 100;
            if (totalAmtStr.endsWith('k')) totalAmt *= 1000;
            if (totalAmtStr.endsWith('m')) totalAmt *= 1000000;
            totalAmt *= 100;

            const splitLines = itemsStr.split(',').map(item => {
                const itemMatch = item.trim().match(/\$?([\d,]+(?:\.\d+)?[km]?)\s*([a-zA-Z\s]+)/i);
                if (itemMatch) {
                    const cleanedItemAmtStr = itemMatch[1].replace(/[km]/i, '');
                    let itemAmt = TruthEngine.parseAmountToCents(cleanedItemAmtStr) / 100;
                    if (itemMatch[1].endsWith('k')) itemAmt *= 1000;
                    if (itemMatch[1].endsWith('m')) itemAmt *= 1000000;
                    return {
                        accountName: itemMatch[2].trim().charAt(0).toUpperCase() + itemMatch[2].trim().slice(1),
                        amountCents: Math.round(itemAmt * 100)
                    };
                }
                return null;
            }).filter(Boolean);

            if (splitLines.length > 0) {
                results.push({
                    amountCents: -totalAmt,
                    description: store.charAt(0).toUpperCase() + store.slice(1),
                    dimensions: {
                        category: splitLines[0]!.accountName,
                        account: "Default Bank"
                    },
                    lines: splitLines.map(l => ({
                        accountName: l!.accountName,
                        amountCents: l!.amountCents
                    })),
                    date: format(new Date(), 'yyyy-MM-dd'),
                    type: "actual"
                });
                continue;
            }
        }

        // 2. Standard Pattern Matching
        const amountRegex = /(?:spent|paid|received|deposited)?\s*\$?([\d,]+(?:\.\d+)?[km]?)\s*(?:for|on|at|from)?\s*([a-zA-Z0-9\s.]+)/i;
        const amountSuffixRegex = /([a-zA-Z0-9\s.]+)\s*\$?([\d,]+(?:\.\d+)?[km]?)/i;

        let match = lowerInput.match(amountRegex);
        let desc = '';
        let amtStr = '';
        const isIncome = lowerInput.includes('received') || lowerInput.includes('deposited') || lowerInput.includes('income') || lowerInput.includes('sale') || lowerInput.includes('plus') || lowerInput.includes('+');

        if (match) {
            amtStr = match[1];
            desc = match[2].trim();
        } else {
            match = lowerInput.match(amountSuffixRegex);
            if (match) {
                desc = match[1].trim();
                amtStr = match[2];
            }
        }

        if (amtStr && desc) {
            const cleanedAmtStr = amtStr.replace(/[km]/i, '');
            let amt = TruthEngine.parseAmountToCents(cleanedAmtStr) / 100;
            if (amtStr.endsWith('k')) amt *= 1000;
            if (amtStr.endsWith('m')) amt *= 1000000;
            amt *= 100; // to cents

            // Deterministic Category Mapping (Hardware logic)
            let category = learnedCategory || "Uncategorized";
            if (!learnedCategory) {
                const dLower = desc.toLowerCase();
                
                // Check provided accounts first (dynamic learning)
                if (options?.accounts) {
                    const dynamicMatch = options.accounts.find(acc => {
                        const name = typeof acc === 'string' ? acc : (acc as any).name;
                        return dLower.includes(name.toLowerCase());
                    });
                    if (dynamicMatch) {
                        category = typeof dynamicMatch === 'string' ? dynamicMatch : (dynamicMatch as any).name;
                    }
                }

                if (category === "Uncategorized") {
                    for (const [cat, keywords] of Object.entries(SEMANTIC_MAP)) {
                      if (keywords.some(k => dLower.includes(k)) || dLower.includes(cat)) {
                        category = cat.charAt(0).toUpperCase() + cat.slice(1);
                        break;
                      }
                    }
                }
            }

            // 3. Date Detection
            let txDate = format(new Date(), 'yyyy-MM-dd');
            const yesterdayMatch = lowerInput.match(/yesterday/i);
            const dateMatch = lowerInput.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
            
            if (yesterdayMatch) {
                txDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');
            } else if (dateMatch) {
                const day = parseInt(dateMatch[1]);
                const monthName = dateMatch[2].toLowerCase();
                const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
                const monthIdx = months.indexOf(monthName);
                if (monthIdx !== -1) {
                    const d = new Date();
                    d.setMonth(monthIdx);
                    d.setDate(day);
                    txDate = format(d, 'yyyy-MM-dd');
                }
            }

            results.push({
                amountCents: isIncome ? amt : -amt,
                description: desc.charAt(0)?.toUpperCase() + desc.slice(1),
                isLearned: isRuleConfirmed,
                dimensions: {
                    category: category,
                    account: "Default Bank"
                },
                date: txDate,
                type: "actual"
            });
        }
    }

    return results.length > 0 ? results : null;
  }
}
