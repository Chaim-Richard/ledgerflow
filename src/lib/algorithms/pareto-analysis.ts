import { AlgorithmDefinition, AlgoResult } from './types';

export const PARETO_ANALYSIS_ALGO: AlgorithmDefinition = {
  id: 'intelligence_pareto',
  name: 'Pareto (80/20) Concentration',
  domain: 'finance',
  tags: ['Concentration', 'Risk', 'Vendors', 'Revenue'],
  description: 'Applies the Pareto Principle to determine if 80% of cash flow is concentrated within a small subset of vendors or customers, indicating high reliance risk.',
  inputs: [
    {
      key: 'analyzeRevenue',
      label: 'Analyze Revenue (1) or Expenses (0)',
      min: 0,
      max: 1,
      step: 1,
      defaultValue: 0
    }
  ],
  compute: (transactions, accounts, inputs): AlgoResult => {
    const isRevenue = inputs['analyzeRevenue'] === 1;
    
    // 1. Group by entity (Payee / Description)
    const entityVolume: Record<string, number> = {};
    let totalVolume = 0;
    
    transactions.forEach(tx => {
      // Very basic categorization based on amount polarity for simplicity.
      // A more robust system would map against accounts.
      if (isRevenue && tx.totalAmountCents < 0) return; // Skip expenses if analyzing revenue
      if (!isRevenue && tx.totalAmountCents > 0) return; // Skip revenue if analyzing expenses
      
      const absAmount = Math.abs(tx.totalAmountCents);
      if (absAmount === 0) return;
      
      const name = (tx.payee || tx.description || 'Unknown').trim();
      if (!name || name.toLowerCase() === 'unknown') return;
      
      if (!entityVolume[name]) entityVolume[name] = 0;
      entityVolume[name] += absAmount;
      totalVolume += absAmount;
    });
    
    // Sort entities by volume (descending)
    const sortedEntities = Object.keys(entityVolume).sort((a, b) => entityVolume[b] - entityVolume[a]);
    
    if (sortedEntities.length === 0) {
      return {
        metrics: [],
        charts: [],
        insights: ['No relevant transactions found for the selected analysis mode.']
      };
    }
    
    // Calculate Pareto curve
    let cumulativeVolume = 0;
    const target80 = totalVolume * 0.8;
    let entitiesTo80 = 0;
    
    const chartData = [];
    
    for (let i = 0; i < sortedEntities.length; i++) {
      const entity = sortedEntities[i];
      const volume = entityVolume[entity];
      cumulativeVolume += volume;
      
      const cumulativePct = (cumulativeVolume / totalVolume) * 100;
      
      if (cumulativeVolume <= target80 || entitiesTo80 === 0) { // Catch the one that crosses the line
         if (cumulativeVolume >= target80 && entitiesTo80 === 0) {
             entitiesTo80 = i + 1;
         } else if (cumulativeVolume < target80) {
             entitiesTo80 = i + 1;
         }
      }
      
      // Keep chart clean, top 20 or until 90%
      if (i < 20 || cumulativePct < 90) {
        chartData.push({
          Entity: entity.substring(0, 15),
          'Volume ($)': parseFloat((volume / 100).toFixed(2)),
          'Cumulative (%)': parseFloat(cumulativePct.toFixed(1))
        });
      }
    }
    
    // Prevent zero if target crossed on first item
    if (entitiesTo80 === 0 && sortedEntities.length > 0) entitiesTo80 = 1;
    
    const concentrationPct = (entitiesTo80 / sortedEntities.length) * 100;
    
    const insights = [];
    insights.push(`Analyzed ${sortedEntities.length} unique entities generating $${(totalVolume / 100).toLocaleString()}.`);
    
    if (concentrationPct <= 20) {
      insights.push(`⚠️ High Concentration Risk: 80% of volume comes from just ${entitiesTo80} entities (${concentrationPct.toFixed(1)}% of total pool).`);
    } else {
      insights.push(`Volume is well-distributed. It takes ${entitiesTo80} entities (${concentrationPct.toFixed(1)}% of total pool) to reach 80% of volume.`);
    }

    return {
      metrics: [
        { label: 'Total Entities', value: sortedEntities.length },
        { label: 'Entities to 80%', value: entitiesTo80, color: concentrationPct <= 20 ? 'text-rose-500' : 'text-slate-500' },
        { label: 'Concentration', value: `${concentrationPct.toFixed(1)}%`, color: concentrationPct <= 20 ? 'text-rose-500' : 'text-slate-500' }
      ],
      charts: [
        {
          config: {
            xKey: 'Entity',
            yKeys: [
              { key: 'Volume ($)', name: 'Volume ($)', color: '#94a3b8', type: 'bar' },
              { key: 'Cumulative (%)', name: 'Cumulative (%)', color: '#6366f1', type: 'line' }
            ]
          },
          data: chartData
        }
      ],
      insights
    };
  }
};
