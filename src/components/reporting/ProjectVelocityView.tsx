import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface ProjectVelocityViewProps {
  projects: any[];
  transactions: any[];
  formatCurrency: (val: number) => string;
}

const ProjectVelocityView = React.memo(({ projects, transactions, formatCurrency }: ProjectVelocityViewProps) => {
  const projectData = useMemo(() => {
    if (!Array.isArray(projects) || !Array.isArray(transactions)) return [];
    
    const txsByProject = new Map<string, any[]>();
    for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        if (!t.lines) continue;
        for (let j = 0; j < t.lines.length; j++) {
            const l = t.lines[j];
            if (l.project) {
              if (!txsByProject.has(l.project)) txsByProject.set(l.project, []);
              const bucket = txsByProject.get(l.project)!;
              if (!bucket.includes(t)) bucket.push(t);
            }
        }
    }

    return projects.map(p => {
      const projectTxs = txsByProject.get(p.name) || [];
      let income = 0;
      let expenses = 0;
      for (let k = 0; k < projectTxs.length; k++) {
        const t = projectTxs[k];
        const relevantLines = t.lines?.filter((l: any) => l.project === p.name) || [];
        for (let m = 0; m < relevantLines.length; m++) {
          const l = relevantLines[m];
          const accName = l.accountName?.toLowerCase() || '';
          if (accName.includes('income') || accName.includes('revenue')) {
            income += Math.abs(l.amountCents);
          } else if (accName.includes('expense') || accName.includes('cost')) {
            expenses += Math.abs(l.amountCents);
          }
        }
      }
      
      return {
        name: p.name,
        profit: income - expenses
      };
    }).sort((a, b) => b.profit - a.profit);
  }, [projects, transactions]);
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-12 rounded-[48px] border border-zinc-200 shadow-xl"
    >
      <div className="flex justify-between items-center mb-12">
        <div>
          <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">Project Profitability</h3>
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mt-1">Margin Analysis by Project</p>
        </div>
      </div>
      <div className="h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={projectData} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
            <XAxis 
              type="number"
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 700 }}
              tickFormatter={(val) => `$${val/1000}k`}
            />
            <YAxis 
              dataKey="name" 
              type="category"
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#71717a', fontSize: 11, fontWeight: 600 }}
              width={120}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                borderRadius: '16px', 
                border: '1px solid #f4f4f5'
              }}
              formatter={(val: number) => [formatCurrency(val), 'Profit']}
            />
            <Bar dataKey="profit" radius={[0, 8, 8, 0]}>
              {projectData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#10b981' : '#f43f5e'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
});

export default ProjectVelocityView;
