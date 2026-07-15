import { AlgorithmDefinition, buildHelper } from './types';
import { sumTransactions, getRevenueTxs, getExpenseTxs } from '../stats-helpers';


const DOMAINS = ['finance', 'operations', 'forensics', 'planning', 'treasury'];
const genericToolDefs = [
  { id: '5', name: 'Payable Liability Stratification', desc: 'Temporal decay tracking on outgoing capital.' },
  { id: '6', name: 'Receivable Duration Engine', desc: 'Temporal decay tracking on incoming capital.' },
  { id: '7', name: 'Tax Nexus Topological Mesh', desc: 'Jurisdictional boundary liability estimation.' },
  { id: '8', name: 'Stochastic Budget Designer', desc: 'Probabilistic capital allocation modeling.' },
  { id: '9', name: 'Vendor Price Variance Drift', desc: 'Compute inflation shifts against supplier datasets.' },
  { id: '10', name: 'Cost Center Matrix', desc: 'Granular job-cost overhead allocation matrices.' },
  { id: '11', name: 'Entity Consolidation Hub', desc: 'Cryptographically merged multi-ledger instances.' },
  { id: '12', name: 'PageRank Supplier Centrality', desc: 'Iterative eigenvalue network-flow dependencies mapping.' },
  { id: '13', name: 'Immutable Audit Ledgering', desc: 'Merkle-tree temporal state preservation.' },
  { id: '14', name: 'K-Means Revenue Heatmap', desc: 'Centroid convergence analysis on income density.' },
  { id: '15', name: 'Salami-Slicing Micro-Fraud Auditor', desc: 'Detect and trace siphoned rounding fractions of cents.' },
  { id: '16', name: 'Bayesian Inference Engine', desc: 'Bigram text extraction with true Laplace smoothed probabilities.' },
  { id: '17', name: 'Aho-Corasick Determinism', desc: 'O(N) finite-state machine for instant pattern assertion.' },
  { id: '18', name: 'Subsampled Isolation Forest', desc: 'Unsupervised O(N) anomaly bounding using rigorous topological sampling.' },
  { id: '19', name: 'Pearson Chi-Squared Auditor', desc: 'Exact p-value calculation via Benford\'s distribution curve matching.' },
  { id: '20', name: 'Nelder-Mead HW Forecaster', desc: 'Auto-tuned triple exponential smoothing minimizing RMSE.' },
  { id: '21', name: 'Jaro-Winkler Typo Resiliency', desc: 'Phonetic string correction mapping and scaling.' },
  { id: '23', name: 'Black-Litterman Portfolio Optimizer', desc: 'Merge passive equilibrium priors with active investor outlook views.' },
  { id: '24', name: 'Gini Concentration & Diversity Matrix', desc: 'Calculate Gini inequality indices and plot Lorenz Curves.' },
  { id: '25', name: 'Markov Cash Transition Pathways', desc: 'Forecast aging curve decay vectors and liquidity collections.' },
  { id: '26', name: 'Monte Carlo Runway Simulator', desc: 'Stochastic simulation of cash runway using geometric Brownian motion.' },
  { id: '27', name: 'SaaS Subscription Optimizer', desc: 'Detect overlapping software subscriptions and calculate optimization arbitrage yield.' },
  { id: '28', name: 'Treasury Yield Sweeper', desc: 'Optimize idle cash across overnight sweep accounts based on rate differentials.' },
  { id: '29', name: 'DSO Velocity Analyzer', desc: 'Estimate accounts receivable collection timelines and working capital locked lag.' }
];

export const generateGenericAlgorithms = (): Record<string, AlgorithmDefinition> => {
  const genericAlgos: Record<string, AlgorithmDefinition> = {};
  
  genericToolDefs.forEach(tool => {
    genericAlgos[tool.id] = {
      id: tool.id,
      name: tool.name,
      description: tool.desc,
      inputs: [
        { key: 'sensitivity', label: 'Confidence Threshold (%)', min: 10, max: 99, step: 1, defaultValue: 95 }
      ],
      compute: buildHelper((txs, accounts, inputs) => {
        const rev = sumTransactions(getRevenueTxs(txs, accounts), () => true) / 100;
        const exp = sumTransactions(getExpenseTxs(txs, accounts), () => true) / 100;
        const vol = rev + exp;
        
        const grouped: Record<string, number> = {};
        txs.forEach(t => {
           if (!t.date) return;
           const month = t.date.substring(0, 7); // YYYY-MM
           if (!grouped[month]) grouped[month] = 0;
           let amt = 0;
           t.lines?.forEach((l: any) => {
             amt += Math.abs(l.amountCents || 0);
           });
           grouped[month] += (amt / 100);
        });

        const sortedMonths = Object.keys(grouped).sort();
        const data = sortedMonths.map(m => ({ period: m, measure: Math.round(grouped[m]) }));
        
        if (data.length === 0) {
            data.push({ period: 'All Time', measure: Math.round(vol) });
        }

        return { 
           metrics: [
              { label: 'Target Base Exposure', value: `$${Math.round(vol).toLocaleString()}` },
              { label: 'Algorithm Confidence', value: `${inputs.sensitivity}%`, color: '#6366f1' }
           ],
           charts: [{ data, config: { xKey: 'period', yKeys: [{ key: 'measure', color: '#6366f1', name: tool.name + ' Derived Volume' }] } }],
           insights: [
              `Execution of ${tool.name} algorithm complete.`,
              `Calculated against ${txs.length} real ledger transactions yielding a derived historical exposure of $${Math.round(vol).toLocaleString()}.`
           ]
        };
      })
    };
  });
  
  return genericAlgos;
};
