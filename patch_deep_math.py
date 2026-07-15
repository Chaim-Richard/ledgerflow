import re

with open('src/lib/algorithms/deep-math.ts', 'r') as f:
    content = f.read()

# Benford's Law
content = content.replace(
"""        data.push({
          Digit: i.toString(),
          Expected: exp.toFixed(1) + '%',
          Actual: actual.toFixed(1) + '%',
          Variance: divergence.toFixed(1) + '%'
        });""",
"""        data.push({
          Digit: i.toString(),
          Expected: parseFloat(exp.toFixed(1)),
          Actual: parseFloat(actual.toFixed(1)),
          Variance: parseFloat(divergence.toFixed(1))
        });"""
)
content = content.replace(
"""      charts: [
        { title: 'Leading Digit Distribution vs Expected', type: 'table', data }
      ],""",
"""      charts: [
        { data, config: { xKey: 'Digit', yKeys: [{ key: 'Expected', color: '#94a3b8', name: 'Expected %', type: 'line' }, { key: 'Actual', color: '#10b981', name: 'Actual %', type: 'bar' }] } }
      ],"""
)

# Holt's Smoothing
content = content.replace(
"""      charts: [
        { title: 'Holt\\'s Double Exponential Forecast', type: 'table', data: chartData }
      ],""",
"""      charts: [
        { data: chartData, config: { xKey: 'Month', yKeys: [{ key: 'Actual', color: '#94a3b8', name: 'Actual', type: 'line' }, { key: 'Trend_Fitted', color: '#6366f1', name: 'Fitted', type: 'line' }, { key: 'Forecast', color: '#10b981', name: 'Forecast', type: 'line' }] } }
      ],"""
)

# K-Means
content = content.replace(
"""        data.push({
          Cluster: `Cluster ${i+1}`,
          Centroid: '$' + Math.round(c).toLocaleString(),
          Item_Count: count.toString(),
          Min_Value: '$' + Math.round(min).toLocaleString(),
          Max_Value: '$' + Math.round(max).toLocaleString()
        });""",
"""        data.push({
          Cluster: `Cluster ${i+1}`,
          Centroid: Math.round(c),
          Item_Count: count,
          Min_Value: Math.round(min),
          Max_Value: Math.round(max)
        });"""
)
content = content.replace(
"""      charts: [
        { title: 'K-Means Clusters', type: 'table', data }
      ],""",
"""      charts: [
        { data, config: { xKey: 'Cluster', yKeys: [{ key: 'Centroid', color: '#8b5cf6', name: 'Centroid', type: 'bar' }, { key: 'Item_Count', color: '#ec4899', name: 'Item Count', type: 'line' }] } }
      ],"""
)

# MACD
content = content.replace(
"""      charts: [
        { title: 'MACD Momentum Oscillation', type: 'table', data: chartData.slice(-12) } // Last 12 months
      ],""",
"""      charts: [
        { data: chartData.slice(-12), config: { xKey: 'Month', yKeys: [{ key: 'MACD', color: '#3b82f6', name: 'MACD', type: 'line' }, { key: 'Signal', color: '#f59e0b', name: 'Signal', type: 'line' }, { key: 'Histogram', color: '#10b981', name: 'Histogram', type: 'bar' }] } }
      ],"""
)

# Monte Carlo
content = content.replace(
"""      charts: [
        { title: 'Stochastic Simulation Distribution', type: 'table', data: histData }
      ],""",
"""      charts: [
        { data: histData, config: { xKey: 'Range', yKeys: [{ key: 'Count', color: '#8b5cf6', name: 'Frequency', type: 'bar' }] } }
      ],"""
)

# DuPont
content = content.replace(
"""    const data = [
      { Metric: 'Net Profit Margin (Operating Efficiency)', Value: (profitMargin * 100).toFixed(2) + '%' },
      { Metric: 'Asset Turnover (Asset Efficiency)', Value: assetTurnover.toFixed(2) + 'x' },
      { Metric: 'Equity Multiplier (Financial Leverage)', Value: equityMultiplier.toFixed(2) + 'x' },
      { Metric: 'Return on Equity (ROE)', Value: (roe * 100).toFixed(2) + '%' }
    ];""",
"""    const data = [
      { Metric: 'Net Profit Margin', Value: parseFloat((profitMargin * 100).toFixed(2)) },
      { Metric: 'Asset Turnover', Value: parseFloat(assetTurnover.toFixed(2)) },
      { Metric: 'Equity Multiplier', Value: parseFloat(equityMultiplier.toFixed(2)) },
      { Metric: 'ROE', Value: parseFloat((roe * 100).toFixed(2)) }
    ];"""
)
content = content.replace(
"""      charts: [
        { title: 'DuPont Deconstruction Matrix', type: 'table', data }
      ],""",
"""      charts: [
        { data, config: { xKey: 'Metric', yKeys: [{ key: 'Value', color: '#10b981', name: 'Value', type: 'bar' }] } }
      ],"""
)


with open('src/lib/algorithms/deep-math.ts', 'w') as f:
    f.write(content)

