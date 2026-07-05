import React, { useMemo } from 'react';
import { 
  Activity, 
  Zap, 
  ShieldCheck, 
  BarChart3
} from 'lucide-react';
import { Transaction, ChartAccount, Project } from '../../types';
import { useAuditTelemetry } from '../../hooks/useAuditTelemetry';

interface FiscalMatrixProps {
  transactions: Transaction[];
  accounts: ChartAccount[];
  projects: Project[];
  metrics?: any;
}

import ToolsCatalog from '../platform/ToolsCatalog';

export default function FiscalMatrix({ transactions, accounts, projects, metrics: passedMetrics }: FiscalMatrixProps) {
  const telemetry = useAuditTelemetry(transactions, accounts, 30, passedMetrics);

  const vectors = useMemo(() => [
    { label: 'Liquidity Index', value: telemetry.kpis.healthScore.toFixed(0), unit: 'IDX', icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-600/10' },
    { label: 'Compliance Rating', value: telemetry.kpis.complianceScore.toFixed(1), unit: '%', icon: ShieldCheck, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Operational Health', value: telemetry.kpis.healthScore.toFixed(0), unit: 'SCORE', icon: BarChart3, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Estimated Burn', value: (telemetry.kpis.burnRate * 30 / 1000).toFixed(1), unit: 'K/mo', icon: Zap, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  ], [telemetry]);

  const CURRENCY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div className="space-y-12">
      <ToolsCatalog />
    </div>
  );
}
