import { useMemo } from 'react';
import { Transaction, ChartAccount, Project } from '../types';
import { endOfQuarter, differenceInMonths } from 'date-fns';
import { RootOptimizer } from '../lib/algorithms';
import { StrategicExpertSystem } from '../lib/StrategicExpertSystem';

export interface StressConfig {
  active: boolean;
  shockAmountCents: number; // e.g. 500,000 * 100
  revenueDropRatio: number; // 0 to 1
}

export function useSituationTelemetry(
  transactions: Transaction[], 
  accounts: ChartAccount[], 
  projects: Project[],
  metrics: any, // ruleMetrics
  strategy: 'growth' | 'stability' | 'tax-optimization' | 'exit',
  stressConfig?: StressConfig
) {
  return useMemo(() => {
    // Apply Stress Shocks (Ghost Branch)
    const isStressed = stressConfig?.active;
    const rawRevenue = metrics.kpis.revenue;
    const rawExpenses = metrics.kpis.expenses;
    const rawTotalCash = metrics.kpis.totalCash;

    const stressedRevenue = isStressed 
      ? rawRevenue * (1 - (stressConfig.revenueDropRatio || 0))
      : rawRevenue;
    
    const stressedExpenses = rawExpenses; 
    const stressedTotalCash = isStressed
      ? Math.max(0, rawTotalCash - (stressConfig.shockAmountCents || 0))
      : rawTotalCash;

    const currentCash = stressedTotalCash / 100;
    const monthlyNet = (stressedRevenue - stressedExpenses) / 100;

    // Derived Stability and Resilience
    const netCashHistory = metrics.timeSeries.map((t: any) => t.net);
    const stabilityIndex = RootOptimizer.calculateStabilityIndex(netCashHistory);
    // Adjust resilience based on stress
    const dailyBurn = stressedExpenses / 100 / 30;
    const monthlyBurn = dailyBurn * 30;
    const resilienceScore = RootOptimizer.calculateResilienceScore(stressedTotalCash / 100, monthlyBurn);
    
    // Q2 Projection (Deterministic)
    const today = new Date();
    const q2End = endOfQuarter(today);
    const monthsToQ2End = Math.max(0, differenceInMonths(q2End, today) + 1);
    const projectedCashQ2 = currentCash + (monthlyNet * monthsToQ2End);

    // Tax Shield (Deterministic based on project presence)
    const hasRD = projects.some(p => (p.name || '').toLowerCase().includes('r&d'));
    const baseTaxRate = 0.25;
    const taxShieldRatio = hasRD ? 0.15 : baseTaxRate;
    
    const yearProfit = monthlyNet * 12;
    const estTaxLiability = yearProfit > 0 ? yearProfit * taxShieldRatio : 0;

    const evMultiplier = strategy === 'exit' ? 8.5 : strategy === 'growth' ? 4.5 : 3.5;
    const enterpriseValue = Math.max(0, monthlyNet * 12 * evMultiplier);

    return {
      currentCash,
      monthlyNet,
      projectedCashQ2,
      taxShieldRatio,
      estTaxLiability,
      enterpriseValue,
      evMultiplier,
      runway: dailyBurn > 0 ? (currentCash / dailyBurn / 30) : 99,
      healthScore: metrics.kpis.healthScore,
      revenue: stressedRevenue / 100,
      expenses: stressedExpenses / 100,
      burnRate: dailyBurn,
      stabilityIndex,
      resilienceScore,
      isStressed,
      strategicFlags: StrategicExpertSystem.analyze(metrics, strategy),
      playbooks: StrategicExpertSystem.getPlaybooks(metrics)
    };
  }, [metrics, strategy, stressConfig]);
}
