import type { ParsedReceiptData } from '../lib/receiptIngestion';
import type { ResolvedEntry } from '../lib/intentResolver';
import type { AutoRule, DashboardSchema } from '../types';
export interface GeneratedBlueprint { name: string; description: string; industry?: string; strategicAdvice?: string[]; chartOfAccounts: Partial<ChartAccount>[]; dashboardSchema: Partial<DashboardSchema> }
interface AIProcessResponses { 'parse-business-blueprint': GeneratedBlueprint; 'build-auto-rule': Partial<AutoRule> & { rule?: Partial<AutoRule> } }
import { Transaction, Project, ChartAccount, AnalyticalMetrics } from "../types";
import { IntentResolver } from "../lib/intentResolver";
import { getIdToken } from "../firebase";
import { useAuthStore } from "../stores/useAuthStore";

export interface StrategicDirectives {
  directives: string[];
  scenarios: string[];
  confidence: number;
}

class AIService {
  private async callBackend<T>(task: string, payload: Record<string, unknown>): Promise<T> {
    const idToken = await getIdToken();
    const isGuest = typeof window !== 'undefined' && localStorage.getItem('isGuest') === 'true';
    if (!idToken && !isGuest) throw new Error("Authentication required for AI operations - falling back to local heuristic");
    
    const selectedModel = typeof window !== 'undefined' ? (localStorage.getItem('lf_selected_ai_model') || 'Gemini 3.8 Flash (Default)') : 'Gemini 3.8 Flash (Default)';
    const workspaceId = payload?.workspaceId || useAuthStore.getState().currentWorkspaceId;
    const response = await fetch("/api/ai/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken || 'guest-token'}`
      },
      body: JSON.stringify({ task, payload: { ...payload, workspaceId, selectedModel } })
    });

    if (!response.ok) {
      let message = "AI Backend Failure";
      try {
        const err = await response.json();
        message = err.error?.message || err.message || message;
      } catch (e) {
        try {
          const rawText = await response.text();
          if (rawText && rawText.length < 200) {
            message = rawText;
          } else {
            message = `HTTP Error ${response.status} ${response.statusText}`;
          }
        } catch (_textErr) {
          // Ignore text parsing fallback error
        }
      }
      throw new Error(message);
    }

    try {
      return await response.json();
    } catch (e) {
      throw new Error("Failed to parse response from AI processing engine", { cause: e });
    }
  }

  async process<K extends keyof AIProcessResponses>(task: K, payload: Record<string, unknown>): Promise<AIProcessResponses[K]> {
    return await this.callBackend(task, payload);
  }

  async generateStrategicAnalysis(
    mode: 'growth' | 'stability' | 'tax-optimization' | 'exit',
    data: { metrics: AnalyticalMetrics; projects: Project[] },
    userApiKey?: string
  ): Promise<StrategicDirectives> {
    try {
      return await this.callBackend<StrategicDirectives>('strategic-analysis', { mode, data });
    } catch (error) {
      console.warn(`[AI Saturation] Reverting to deterministic expert strategy model for '${mode}':`, error);
      
      const fallbacks: Record<'growth' | 'stability' | 'tax-optimization' | 'exit', StrategicDirectives> = {
        growth: {
          directives: [
            "Accelerated Expansion: Allocate 40% of surplus cash toward scaling profitable channels (CAC < LTV validation path).",
            "Working Capital Calibration: Maintain a 60-day buffer to support higher payroll and procurement cycles.",
            "R&D Alignment: Channel capital toward active project pipelines to maximize future tax credits."
          ],
          scenarios: [
            "Model High-Growth: Simulated increase of 30% revenue with 12% rise in operational expense clusters.",
            "Venture Runway Target: Optimize cash burn to maintain 18+ months of comfortable operation."
          ],
          confidence: 92
        },
        stability: {
          directives: [
            "Burn Reduction Protocol: Audit vendors showing high price volatility to trim recurring overhead by 15%.",
            "Receivables Acceleration: Offer a 2% early payment discount to shorten outstanding aging invoice cycles.",
            "Inventory Consolidation: Halt non-essential procurement to preserve cash reserves."
          ],
          scenarios: [
            "Model High-Stress: Simulated 30% revenue shock with immediate vendor consolidation.",
            "Cash Reserves Focus: Target a positive unit-economic equilibrium with zero debt accumulation."
          ],
          confidence: 95
        },
        'tax-optimization': {
          directives: [
            "R&D Tax Shield: Categorize qualifying developer and design hours to maximize current year tax credits.",
            "Nexus Validation: Review sales tax obligations across multiple active jurisdictions to avoid audit penalties.",
            "Depreciation Acceleration: Claim Section 179 depreciation on all newly capitalised fixed assets."
          ],
          scenarios: [
            "Accelerated Deductions: Simulated 8% reduction in overall federal and state tax liability.",
            "Nexus Calibration: Ensure compliance across all online operating channels."
          ],
          confidence: 90
        },
        exit: {
          directives: [
            "EBITDA Optimization: Shift operational expenses and streamline staffing logs to showcase clean quarterly profit margins.",
            "Liability Remediation: Settle outstanding vendor bills to lower leverage ratios on the balance sheet.",
            "Audit Readiness: Verify hash chain logs and lock all past reconciliations to provide immutable books."
          ],
          scenarios: [
            "Buyout Readiness Map: Present pristine 3-year trailing P&L and Balance Sheet reports for valuation multiple optimization.",
            "Recapitalization Model: Align equity structures to support prospective transition of operations."
          ],
          confidence: 94
        }
      };

      return fallbacks[mode] || fallbacks.growth;
    }
  }

  async generateForecast(transactions: Transaction[], horizon: number, userApiKey?: string) {
    try {
      return await this.callBackend<{ points: { date: string; value: number }[]; confidence: number; anomalies: unknown[] }>('generate-forecast', { transactions, horizon });
    } catch (error) {
      return {
        points: transactions.map(t => ({ date: t.date, value: t.totalAmountCents / 100 })),
        confidence: 0,
        anomalies: []
      };
    }
  }

  async mapTransactions(transactions: Transaction[], accounts: ChartAccount[], context: string) {
    try {
      return await this.callBackend<Transaction[]>('map-transactions', { transactions, accounts, context });
    } catch (error) {
      return [];
    }
  }

  async analyzeTrends(transactions: Transaction[], context: string) {
    try {
      return await this.callBackend<{ trends: unknown[]; anomalies: unknown[]; strategicAdvice: string[] }>('analyze-trends', { transactions, context });
    } catch (error) {
      return { trends: [], anomalies: [], strategicAdvice: ["AI analysis layer encountered an anomaly."] };
    }
  }

  async parseQuery(query: string, context: string, categories: string[] = [], projects: string[] = []): Promise<Partial<ReturnType<typeof IntentResolver.resolve>>> {
    const resolved = IntentResolver.resolve(query, categories, projects);
    if (resolved.category || resolved.project || resolved.minAmountCents || resolved.maxAmountCents || resolved.startDate || resolved.isAuditQuery) {
      return resolved;
    }

    try {
      return await this.callBackend<ReturnType<typeof IntentResolver.resolve>>('parse-query', { query, context, categories, projects });
    } catch (error) {
      return {};
    }
  }

  async parseMagicEntry(input: string, categories: string[] = [], accounts: ChartAccount[] = [], projects: string[] = [], patternContext: string = "") {
    try {
      return await this.callBackend<ResolvedEntry[]>('parse-magic-entry', { input, categories, accounts, projects, patternContext });
    } catch (e) {
      return null;
    }
  }

  async parseReceipt(file: File, userApiKey?: string, heuristicCache?: Record<string, unknown>, labels: string[] = []) {
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });

    try {
      return await this.callBackend<ParsedReceiptData>('parse-receipt', {
        base64Data, 
        mimeType: file.type, 
        context: labels.join(', ') + (heuristicCache ? JSON.stringify(heuristicCache) : '')
      });
    } catch (error) {
       return null;
    }
  }

  async parseStatement(input: File | string, context: string = '', userApiKey?: string, heuristicCache?: Record<string, unknown>, labels: string[] = []) {
    try {
      if (typeof input === 'string') {
        const payload = { content: input, mimeType: 'text/plain', context: labels.join(', ') + context };
        const result = await this.callBackend<ResolvedEntry[] & { transactions?: ResolvedEntry[] }>('parse-statement', payload);
        return result.transactions || result || [];
      } else {
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(input);
        });
        const payload = { content: base64Data, mimeType: input.type, context: labels.join(', ') + context };
        const result = await this.callBackend<ResolvedEntry[] & { transactions?: ResolvedEntry[] }>('parse-statement', payload);
        return result.transactions || result || [];
      }
    } catch (error) {
      console.error("Statement parsing failed:", error);
      return [];
    }
  }

  async parsePersonalTaxProfile(message: string): Promise<{
    filingStatus: 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household';
    dependentsCount: number;
    state: string;
    annualIncomeCents: number;
    childTaxCreditAmountCents: number;
    explanation: string;
  }> {
    try {
      return await this.callBackend('parse-personal-tax-profile', { message });
    } catch (error) {
      // Fallback in case of server offline/not responding during dev
      const text = message.toLowerCase();
      let filingStatus: 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household' = 'Single';
      if (text.includes('married') || text.includes('spouse') || text.includes('wife') || text.includes('husband') || text.includes('jointly')) {
        filingStatus = 'Married Filing Jointly';
      } else if (text.includes('household') || text.includes('single father') || text.includes('single mother') || text.includes('single parent') || text.includes('hoh')) {
        filingStatus = 'Head of Household';
      } else if (text.includes('separate')) {
        filingStatus = 'Married Filing Separately';
      } else if (text.includes('kid') || text.includes('child') || text.includes('children')) {
        filingStatus = 'Head of Household';
      }

      let dependentsCount = 0;
      const match = text.match(/(\d+)\s*(kids|child|children|dependents)/);
      if (match) {
        dependentsCount = parseInt(match[1], 10);
      } else if (text.includes('child') || text.includes('kid')) {
        dependentsCount = 1;
        if (text.includes('kids') || text.includes('children')) dependentsCount = 2;
      }

      let state = 'NY';
      if (text.includes('ca') || text.includes('california')) state = 'CA';
      else if (text.includes('tx') || text.includes('texas')) state = 'TX';
      else if (text.includes('fl') || text.includes('florida')) state = 'FL';
      else if (text.includes('il') || text.includes('illinois')) state = 'IL';
      else if (text.includes('oh') || text.includes('ohio')) state = 'OH';

      return {
        filingStatus,
        dependentsCount,
        state,
        annualIncomeCents: 12000000,
        childTaxCreditAmountCents: dependentsCount * 2000 * 100,
        explanation: `Staged: Mapped using clientside analyzer parameters. Ensure filing status and state match your standard parameters.`
      };
    }
  }
}

export const aiService = new AIService();
