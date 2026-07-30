import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { sha256Sync } from "../lib/algorithms";

export class AIBackendService {
  private genAI: GoogleGenAI;
  
  // Static memory cache (persists across per-request AIBackendService instantiations)
  public static apiCache = new Map<string, any>();
  public lastUsageMetadata: any = null;

  private async generateContent(params: any) {
    const result = await this.genAI.models.generateContent(params);
    this.lastUsageMetadata = result.usageMetadata;
    return result;
  }

  constructor(apiKey: string) {
    this.genAI = new GoogleGenAI({ apiKey });
  }

  public static getCachedResponse(task: string, payload: any): any | null {
    const wsId = payload?.workspaceId || 'no-ws';
    const uid = payload?.uid || 'no-uid';
    const key = `${task}-${wsId}-${uid}-${sha256Sync(JSON.stringify(payload || {}))}`;
    return this.apiCache.get(key) || null;
  }

  public static setCachedResponse(task: string, payload: any, response: any): void {
    const wsId = payload?.workspaceId || 'no-ws';
    const uid = payload?.uid || 'no-uid';
    const key = `${task}-${wsId}-${uid}-${sha256Sync(JSON.stringify(payload || {}))}`;
    if (this.apiCache.size >= 1000) {
      const firstKey = this.apiCache.keys().next().value;
      if (firstKey) this.apiCache.delete(firstKey);
    }
    this.apiCache.set(key, response);
  }

  private safeJsonParse(text: string | null | undefined, fallback: any = {}) {
    if (!text) return fallback;
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.warn("safeJsonParse failed to parse text:", text);
      return fallback;
    }
  }

  private getModel(payload: any): string {
    const selectedModel = payload?.selectedModel || '';
    const lower = selectedModel.toLowerCase();
    if (lower.includes('pro') || lower.includes('3.1-pro')) {
      return 'gemini-3.1-pro-preview';
    }
    if (lower.includes('lite') || lower.includes('3.1-flash-lite')) {
      return 'gemini-3.1-flash-lite';
    }
    return 'gemini-3.0-flash';
  }

  /**
   * Universal AI Resolver for Financial Intelligence
   */
  async process(task: string, payload: any): Promise<any> {
    const cached = AIBackendService.getCachedResponse(task, payload);
    if (cached) {
      console.debug(`[AI Cache Hit] Task: ${task} resolved from static memory cache.`);
      return cached;
    }

    let result: any;
    switch (task) {
      case 'parse-personal-tax-profile':
        result = await this.parsePersonalTaxProfile(payload);
        break;
      case 'analyze-trends':
        result = await this.analyzeTrends(payload);
        break;
      case 'strategic-analysis':
        result = await this.strategicAnalysis(payload);
        break;
      case 'chat':
        result = await this.chat(payload);
        break;
      case 'parse-query':
        result = await this.parseQuery(payload);
        break;
      case 'parse-receipt':
        result = await this.parseReceipt(payload);
        break;
      case 'parse-statement':
        result = await this.parseStatement(payload);
        break;
      case 'parse-business-blueprint':
        result = await this.parseBusinessBlueprint(payload);
        break;
      case 'parse-magic-entry':
        result = await this.parseMagicEntry(payload);
        break;
      default:
        throw new Error(`Unsupported AI task: ${task}`);
    }

    AIBackendService.setCachedResponse(task, payload, result);
    return result;
  }

  private async parseBusinessBlueprint(data: any) {
    const { description } = data;
    const prompt = `You are a world-class Forensic Accountant and Business Architect.
      Create a highly realistic, professional-grade Business Blueprint for this business: "${description}".
      
      This blueprint must solve real-world bookkeeping challenges:
      1. Chart of Accounts: Must be granular, following GAAP/IFRS standards where applicable. Include specific codes (e.g., 1000-1999 for Assets, 2000-2999 for Liabilities, 3000-3999 for Equity, 4000-4999 for Income, 5000-5999 for Expenses).
      2. Dashboard Structure: Create a logical flow of financial data. Nodes should represent key metrics, accounts, or processes.
      3. Strategic Advice: Provide 3 high-level strategic financial tips for this specific business model.
      
      CRITICAL FOR REALISM:
      - For a "Service" business, focus on Labor Costs, Utilization, and Project Profitability.
      - For "Retail/E-commerce", focus on Inventory (COGS), Shipping, and Multi-channel Sales.
      - For "Manufacturing", focus on Raw Materials, WIP, and Finished Goods.
      
      The structure schema must include:
      - Nodes with specific X/Y positions (0-1000 range) for a clean layout.
      - Logical connections (links) between nodes.
      - Config for nodes to aggregate data (e.g., accountingGroup: "Revenue").
      
      Return a JSON object following the schema precisely.`;

    const result = await this.generateContent({
      model: this.getModel(data),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "A catchy name for this blueprint" },
            description: { type: Type.STRING, description: "A brief summary of what this blueprint covers" },
            industry: { type: Type.STRING },
            strategicAdvice: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 strategic financial tips"
            },
            chartOfAccounts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["asset", "liability", "equity", "income", "expense"] },
                  category: { type: Type.STRING }
                },
                required: ["code", "name", "type"]
              }
            },
            dashboardSchema: {
              type: Type.OBJECT,
              properties: {
                nodes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      type: { type: Type.STRING },
                      position: {
                        type: Type.OBJECT,
                        properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                        required: ["x", "y"]
                      },
                      data: {
                        type: Type.OBJECT,
                        properties: {
                          label: { type: Type.STRING },
                          value: { type: Type.STRING },
                          accountingGroup: { type: Type.STRING },
                          isConfigurable: { type: Type.BOOLEAN }
                        },
                        required: ["label"]
                      }
                    },
                    required: ["id", "type", "position", "data"]
                  }
                },
                links: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      source: { type: Type.STRING },
                      target: { type: Type.STRING },
                      animated: { type: Type.BOOLEAN }
                    },
                    required: ["id", "source", "target"]
                  }
                }
              },
              required: ["nodes", "links"]
            }
          },
          required: ["name", "description", "industry", "strategicAdvice", "chartOfAccounts", "dashboardSchema"]
        }
      }
    });

    return this.safeJsonParse(result.text, {});
  }

  private async parseQuery(data: any) {
    const { query, context } = data;
    const prompt = `Translate this financial query to a JSON filter object: "${query}". Context: ${context}. Categories: ${data.categories?.join(', ')}. Projects: ${data.projects?.join(', ')}. Return keys: category, project, minAmountCents, maxAmountCents, startDate, endDate, searchTerm.`;
    const result = await this.generateContent({
      model: this.getModel(data),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    return this.safeJsonParse(result.text, {});
  }

  private async parseReceipt(data: any) {
    const { base64Data, mimeType, context } = data;
    let source: any = { inlineData: { data: base64Data, mimeType } };
    const prompt = `Extract receipt data. Context: ${context}. Return vendorName, date, totalAmountCents, taxAmountCents, categorySuggestion, and an array of 'lines' with {description, amountCents, category, quantity, unitPriceCents}.`;
    const result = await this.generateContent({
      model: this.getModel(data),
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          source
        ]
      }],
      config: { 
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    });
    return this.safeJsonParse(result.text, {});
  }

  private async parseStatement(data: any) {
    const { content, mimeType, context } = data;
    let source: any;
    if (mimeType === 'text/plain' || mimeType === 'text/csv') {
      source = { text: content };
    } else {
      source = { inlineData: { data: content, mimeType } };
    }
    const prompt = `Extract all transactions from this bank statement. Context: ${context}. Return a JSON object with a 'transactions' array, each having {date, description, amountCents, categorySuggestion}.`;
    const result = await this.generateContent({
      model: this.getModel(data),
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          source
        ]
      }],
      config: { 
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    });
    return this.safeJsonParse(result.text, {});
  }

  private async analyzeTrends(data: any) {
    const prompt = `System: Executive Anomaly Detection. Analyze the following transaction summary for emerging risks and fiscal opportunities: ${JSON.stringify(data)}`;
    const result = await this.generateContent({
      model: this.getModel(data),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });
    return this.safeJsonParse(result.text, {});
  }

  private async strategicAnalysis(summary: any) {
     const prompt = `System: Rule Financial Architect. Provide 3 strategic narratives based on these KPIs: ${JSON.stringify(summary)}`;
     const result = await this.generateContent({
        model: this.getModel(summary),
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
           responseMimeType: "application/json"
        }
     });
     return this.safeJsonParse(result.text, {});
  }

  private async chat(payload: any) {
    const { query } = payload;
    const prompt = `System: You are an expert financial co-pilot assistant within a professional accounting platform. 
    The user is asking a financial operations or accounting question: "${query}".
    Provide a professional, clear, concise, and highly accurate answer. Use markdown for specific metrics or lists.`;
    
    const result = await this.generateContent({
       model: this.getModel(payload),
       contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return { answer: result.text || "No insights could be generated." };
  }

  private async parsePersonalTaxProfile(data: any) {
    const { message } = data;
    const prompt = `You are a professional US Tax Advisor. Analyze this user's natural language statement describing their personal status, dependents/kids, state, and other financial details: "${message}".
Extract the key tax-relevant fields and return as a clean JSON object with these EXACT keys and types:
{
  "filingStatus": "Single" | "Married Filing Jointly" | "Married Filing Separately" | "Head of Household",
  "dependentsCount": number,
  "state": string (2-letter state code like "NY", "CA", "TX", "FL", "IL", "OH", default "NY"),
  "annualIncomeCents": number,
  "childTaxCreditAmountCents": number,
  "explanation": "A friendly 1-2 sentence overview explaining the standard deduction and child credits that apply for this scenario."
}
Return ONLY a valid JSON string. No markdown formatting blocks or surrounding backticks. Just pure JSON.`;

    try {
      if (!process.env.GEMINI_API_KEY) {
        return this.localParsePersonalTaxProfile(message);
      }
      const result = await this.generateContent({
        model: this.getModel(data),
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });
      return this.safeJsonParse(result.text, {});
    } catch (e: any) {
      return this.localParsePersonalTaxProfile(message);
    }
  }

  private localParsePersonalTaxProfile(message: string): any {
    const text = message.toLowerCase();
    
    // Heuristic 1: Filing Status
    let filingStatus: 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household' = 'Single';
    if (text.includes('married') || text.includes('spouse') || text.includes('wife') || text.includes('husband') || text.includes('jointly')) {
      filingStatus = 'Married Filing Jointly';
    } else if (text.includes('head of household') || text.includes('single father') || text.includes('single mother') || text.includes('single parent') || text.includes('hoh')) {
      filingStatus = 'Head of Household';
    } else if (text.includes('separate')) {
      filingStatus = 'Married Filing Separately';
    } else if (text.includes('single') || text.includes('alone') || text.includes('solo')) {
      filingStatus = 'Single';
    } else if (text.includes('kid') || text.includes('child') || text.includes('children') || text.includes('son') || text.includes('daughter') || text.includes('dependent')) {
      // If unmarried and has kids, default to Head of Household
      filingStatus = 'Head of Household';
    }

    // Heuristic 2: Kids/Dependents Count
    let dependentsCount = 0;
    const numberWords: Record<string, number> = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6 };
    
    // Check for matches like "3 kids", "2 children", "one child"
    const kidRegex = /(\b\d+|one|two|three|four|five|six)\s*(kids|child|children|dependent|son|daughter|dependents)/g;
    let match;
    while ((match = kidRegex.exec(text)) !== null) {
      const val = match[1];
      if (numberWords[val] !== undefined) {
        dependentsCount = numberWords[val];
      } else {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed)) dependentsCount = parsed;
      }
    }

    if (dependentsCount === 0) {
      // direct numeric check
      const numMatch = text.match(/\b(\d)\b\s*(kids|children|dependents)/);
      if (numMatch) {
        dependentsCount = parseInt(numMatch[1], 10);
      } else if (text.includes('child') || text.includes('kid') || text.includes('son') || text.includes('daughter')) {
        dependentsCount = 1;
        if (text.includes('kids') || text.includes('children') || text.includes('sons') || text.includes('daughters')) {
          dependentsCount = 2; // general plural
        }
      }
    }

    // Heuristic 3: State Lookup
    let state = 'NY';
    const states = ['NY', 'CA', 'TX', 'FL', 'IL', 'OH'];
    for (const st of states) {
      if (text.includes(st.toLowerCase()) || 
          (st === 'NY' && text.includes('new york') || text.includes('queens') || text.includes('brooklyn') || text.includes('manhattan')) ||
          (st === 'CA' && text.includes('california') || text.includes('francisco') || text.includes('angeles') || text.includes('silicon')) ||
          (st === 'TX' && text.includes('texas') || text.includes('austin') || text.includes('houston') || text.includes('dallas')) ||
          (st === 'FL' && text.includes('florida') || text.includes('miami') || text.includes('orlando')) ||
          (st === 'IL' && text.includes('illinois') || text.includes('chicago')) ||
          (st === 'OH' && text.includes('ohio') || text.includes('cleveland') || text.includes('columbus'))
      ) {
        state = st;
        break;
      }
    }

    // Heuristic 4: Expected income
    let annualIncomeCents = 12000000; // default $120,000
    const incomeMatch = text.match(/(\d+)\s*k/);
    if (incomeMatch) {
      annualIncomeCents = parseInt(incomeMatch[1], 10) * 1000 * 100;
    } else {
      const fullIncomeMatch = text.match(/\$?\s*(\d{2,3}),?(\d{3})\b/);
      if (fullIncomeMatch) {
        annualIncomeCents = (parseInt(fullIncomeMatch[1], 10) * 1000 + parseInt(fullIncomeMatch[2], 10)) * 100;
      }
    }

    // Heuristic 5: Child Tax credit ($2,000 per dependent count)
    const childTaxCreditAmountCents = dependentsCount * 2000 * 100;

    const stdDec = filingStatus === 'Married Filing Jointly' ? '$30,000' : (filingStatus === 'Head of Household' ? '$22,500' : '$15,000');
    const explanation = `Auto-Learned: Mapped to ${filingStatus} based on profile traits. A standard deduction of ${stdDec} and an eligible Child Tax Credit of $${(childTaxCreditAmountCents/100).toLocaleString()} will be automatically staged.`;

    return {
      filingStatus,
      dependentsCount,
      state,
      annualIncomeCents,
      childTaxCreditAmountCents,
      explanation
    };
  }

  private async parseMagicEntry(data: any) {
    const { input, categories, accounts, projects, patternContext } = data;
    const prompt = `Extract transaction details from this text: "${input}".
        
        CONTEXT:
        - Valid Categories: ${categories.join(', ')}
        - Valid Accounts: ${accounts.map((a: any) => a.name).join(', ')}
        - Valid Projects: ${projects.join(', ')}
        ${patternContext}

        The input can be in English or Hebrew. If the user writes in Hebrew, parse it correctly. 
        Preserve Hebrew for "description" if the input is in Hebrew.
        
        INSTRUCTIONS:
        1. If a description matches a 'PREVIOUSLY LEARNED PATTERN', strictly use that account name in dimensions.category.
        2. Return ONLY a JSON array of objects, each with:
           - amountCents (integer, negative for expenses, positive for income)
           - description (string)
           - dimensions (object with: category, account, project)
           - date (ISO string YYYY-MM-DD, default to today)
           - type (string, "actual" or "forecast")
           - lines (array of objects with: description, amountCents, quantity, unitPriceCents, category)
             * Only include 'lines' if the user explicitly lists multiple items or quantities (e.g. "5x items at $10 each").`;

    const result = await this.generateContent({
      model: this.getModel(data),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });

    return this.safeJsonParse(result.text, []);
  }
}
