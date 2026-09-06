import { AlgorithmDefinition, AlgoResult } from './types';

export const PROFITABILITY_HEATMAP_ALGO: AlgorithmDefinition = {
  id: 'intelligence_5',
  name: 'Profitability Margin Heatmap',
  domain: 'operations',
  tags: ['Profitability', 'Margin', 'Projects', 'Cost Centers'],
  description: 'Analyzes operating margins across projects to identify loss-making initiatives dragging down net profitability.',
  inputs: [
    { key: 'minMarginThreshold', label: 'Warning Margin Threshold (%)', min: 0, max: 50, step: 1, defaultValue: 15 }
  ],
  compute: (ctx, inputs): AlgoResult => {
    const { transactions, accounts } = ctx;
    const warningThreshold = (inputs.minMarginThreshold ?? 15) / 100;

    const projectData: Record<string, { revenue: number, costs: number }> = {};
    let totalRevenue = 0;
    let totalCosts = 0;

    transactions.forEach(tx => {
       if (tx.status === 'void' || tx.status === 'pending') return;
       const projectId = tx.projectId || 'Unassigned';

       tx.lines.forEach(l => {
          const acc = accounts.find(a => a.id === l.accountId);
          if (acc) {
             const type = (acc.type || '').toLowerCase();
             const cat = (acc.category || '').toLowerCase();
             
             if (!projectData[projectId]) projectData[projectId] = { revenue: 0, costs: 0 };
             
             if (type === 'income' || type === 'revenue' || cat === 'revenue') {
                projectData[projectId].revenue += Math.abs(l.amountCents);
                totalRevenue += Math.abs(l.amountCents);
             } else if (type === 'expense' || type === 'cost_of_goods' || cat === 'cogs') {
                projectData[projectId].costs += Math.abs(l.amountCents);
                totalCosts += Math.abs(l.amountCents);
             }
          }
       });
    });

    if (totalRevenue === 0) {
      return {
        metrics: [{ label: 'Status', value: 'No Revenue Data' }],
        charts: [],
        insights: ['Profitability heatmap requires recorded revenue tied to projects.']
      };
    }

    const chartData: any[] = [];
    let lossMakers = 0;
    let starProjects = 0;

    Object.entries(projectData).forEach(([proj, data]) => {
       if (data.revenue > 0 || data.costs > 0) {
          const net = data.revenue - data.costs;
          const margin = data.revenue > 0 ? (net / data.revenue) : -1;
          
          if (margin < warningThreshold) lossMakers++;
          if (margin > 0.4) starProjects++;

          chartData.push({
             Project: proj,
             MarginPct: parseFloat((margin * 100).toFixed(1)),
             NetProfit: net / 100
          });
       }
    });

    chartData.sort((a, b) => b.MarginPct - a.MarginPct);

    const overallMargin = (totalRevenue - totalCosts) / totalRevenue;

    return {
      metrics: [
        { label: 'Overall Profit Margin', value: `${(overallMargin * 100).toFixed(1)}%`, color: overallMargin > warningThreshold ? 'green' : 'orange' },
        { label: 'High-Margin Projects', value: starProjects.toString(), color: 'green' },
        { label: 'At-Risk Projects', value: lossMakers.toString(), color: lossMakers > 0 ? 'red' : 'green' }
      ],
      charts: [
        {
          config: {
            xKey: 'Project',
            yKeys: [{ key: 'MarginPct', name: 'Net Margin (%)', color: '#ec4899', type: 'bar' }]
          },
          data: chartData
        }
      ],
      insights: [
        `Overall entity operating margin is ${(overallMargin * 100).toFixed(1)}%.`,
        `${lossMakers} project(s) are operating below the ${inputs.minMarginThreshold}% warning threshold, dragging down total profitability.`,
        chartData.length > 0 ? `The most profitable segment is ${chartData[0].Project} with a ${chartData[0].MarginPct}% margin.` : ''
      ]
    };
  }
};
