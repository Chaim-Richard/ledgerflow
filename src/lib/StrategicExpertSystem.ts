import { AnalyticalMetrics } from "../types";

export interface StrategicFlag {
  id: string;
  type: 'critical' | 'warning' | 'positive' | 'info';
  title: string;
  directive: string;
  logic: string;
}

export interface PlaybookStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high';
}

export interface ActionPlan {
  id: string;
  title: string;
  objective: string;
  icon: string;
  steps: PlaybookStep[];
  isTriggered: boolean;
}

export type FiscalPlaybook = ActionPlan;

/**
 * Deterministic Strategic Expert System
 * Replaces generative AI advice with hard financial logic.
 * Implements Layer 6: Decision & Optimization.
 */
export class StrategicExpertSystem {
  /**
   * Analyzes telemetry and returns high-fidelity deterministic directives.
   */
  static analyze(metrics: AnalyticalMetrics, mode: string): StrategicFlag[] {
    const flags: StrategicFlag[] = [];
    const kpis = metrics.kpis;
    const trends = metrics.trends;

    // 1. LIQUIDITY & RUNWAY (The most critical vectors)
    if (kpis.runwayMonths < 3 && kpis.expenses > 0) {
      flags.push({
        id: 'liq_critical',
        type: 'critical',
        title: 'Critical Liquidity Alert',
        directive: 'Freeze all non-essential OpEx. Initiate emergency A/R collection process.',
        logic: 'Runway < 90 days. Burn rate exceeds sustainable capital buffer.'
      });
    } else if (kpis.runwayMonths < 6) {
      flags.push({
        id: 'liq_warning',
        type: 'warning',
        title: 'Liquidity Threshold Warning',
        directive: 'Optimize cash conversion cycle. Review 180-day growth commitments.',
        logic: 'Runway < 180 days. Defensive posture recommended.'
      });
    }

    // 2. PROFITABILITY & GROWTH VECTORS
    const ebitdaMargin = kpis.revenue > 0 ? (metrics.kpis.netCash / kpis.revenue) : 0;
    
    if (ebitdaMargin < 0 && mode === 'stability') {
      flags.push({
        id: 'negative_ebitda',
        type: 'warning',
        title: 'Negative Operating Margin',
        directive: 'Audit unit economics. Direct cost reduction of 15% required for stabilization.',
        logic: 'Expenses > Revenue in Stability mode. Structural burn detected.'
      });
    }

    if (trends.revenue > 20 && trends.burnRate > 30) {
      flags.push({
        id: 'hyper_growth_burn',
        type: 'warning',
        title: 'Inefficient Scaling Detected',
        directive: 'Operating leverage is negative. Burn is outpacing revenue acceleration.',
        logic: 'Burn trend (30%+) > Revenue trend (20%). Inefficient capital deployment.'
      });
    }

    // 3. STABILITY & PREDICTABILITY
    const avgStability = metrics.periodicity.reduce((sum: number, p) => sum + p.confidence, 0) / (metrics.periodicity.length || 1);
    if (avgStability < 0.4 && metrics.timeSeries.length > 20) {
      flags.push({
        id: 'low_periodicity',
        type: 'info',
        title: 'High Transaction Variance',
        directive: 'Implement fixed billing cycles. Unpredictability in expenditure prevents deterministic forecasting.',
        logic: 'Statistical confidence < 40%. High variance in cash outflow signals.'
      });
    }

    // 3b. TOPOLOGICAL INTEGRITY (Flow Entropy)
    // We assume metrics might eventually include raw links, but for now we look at graph centrality variance
    const flowDisorder = metrics.graphCentrality.length > 2 
      ? metrics.graphCentrality.reduce((varSum: number, node, _, arr) => varSum + Math.pow(node.score - (1/arr.length), 2), 0)
      : 0;
    
    if (flowDisorder > 0.15) {
      flags.push({
        id: 'flow_imbalance',
        type: 'warning',
        title: 'Account flow imbalance',
        directive: 'Review capital allocation strategy. Resource distribution is highly skewed towards specific accounts.',
        logic: 'Flow variance exceeds safety threshold.'
      });
    }

    // 4. POSITIVE VECTORS
    if (kpis.netCash > 0 && trends.revenue > 10) {
      flags.push({
        id: 'positive_momentum',
        type: 'positive',
        title: 'Positive Financial Outlook',
        directive: 'Maximize R&D allocation. Surplus capital should be deployed into acquisition channels.',
        logic: 'Positive Net Cash + 10% Revenue Growth. Opportunity window open.'
      });
    }

    // Mode-specific overrides
    if (mode === 'exit') {
      flags.push({
        id: 'exit_directive',
        type: 'info',
        title: 'Exit strategy preparation',
        directive: 'Focus on 12-month EBITDA multiples. Clean up all non-operating balance sheet items.',
        logic: 'Exit mode active.'
      });
    }

    // 5. CONCENTRATION RISK
    const topNode = metrics.graphCentrality[0];
    if (topNode && topNode.score > 0.4) {
      flags.push({
        id: 'graph_concentration',
        type: 'warning',
        title: 'High Account Concentration',
        directive: `Diversify vendor dependency. ${topNode.name} represents a systemic concentration risk.`,
        logic: `Flow score (${(topNode.score * 100).toFixed(1)}%) exceeds 40% threshold.`
      });
    }

    return flags;
  }

  /**
   * Generates actionable multi-step plans based on situational context.
   */
  static getPlaybooks(metrics: AnalyticalMetrics): ActionPlan[] {
    const playbooks: ActionPlan[] = [];

    // Plan 1: Runway Extension (Triggered if < 6 months)
    if (metrics.kpis.runwayMonths < 6) {
      playbooks.push({
        id: 'runway_extension',
        title: 'Runway Extension Plan',
        objective: 'Preserve liquidity and extend operational horizon to >9 months.',
        icon: 'ShieldCheck',
        isTriggered: true,
        steps: [
          { id: '1', title: 'Identify Discretionary Outflow', description: 'Audit all non-essential vendor subscriptions.', status: 'pending', priority: 'high' },
          { id: '2', title: 'Vendor Renegotiation', description: 'Target top 3 vendors for payment deferment or discount.', status: 'pending', priority: 'medium' },
          { id: '3', title: 'Inflow Acceleration', description: 'Automate collection reminders for all A/R balances >30 days.', status: 'pending', priority: 'high' }
        ]
      });
    }

    // Plan 2: Growth Efficiency (Triggered if Hyper-Growth mode)
    if (metrics.trends.revenue > 20 && metrics.kpis.revenue > metrics.kpis.expenses) {
      playbooks.push({
        id: 'growth_efficiency',
        title: 'Scalability Audit',
        objective: 'Ensure operational infrastructure scales efficiently relative to revenue.',
        icon: 'Zap',
        isTriggered: true,
        steps: [
          { id: '1', title: 'CAC Analysis', description: 'Verify Customer Acquisition Cost remains below LTV threshold.', status: 'pending', priority: 'high' },
          { id: '2', title: 'Automation Opportunities', description: 'Identify manual financial workflows that can be automated.', status: 'pending', priority: 'medium' }
        ]
      });
    }

    return playbooks;
  }
}
