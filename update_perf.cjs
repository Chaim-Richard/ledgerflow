const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { Target, Award, CheckSquare, ListTodo, Search, UserCheck, PlayCircle, Star, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_REVIEWS = [
  { id: 'REV-26-01', employee: 'Alice Walker', department: 'Engineering', period: 'Q2 2026', reviewer: 'M. Johnson', score: 4.8, status: 'Completed', type: 'Quarterly OKR' },
  { id: 'REV-26-02', employee: 'Bob Smith', department: 'Sales', period: 'Q2 2026', reviewer: 'S. Connor', score: null, status: 'Self-Eval Pending', type: 'Quarterly OKR' },
  { id: 'REV-26-03', employee: 'Charlie Davis', department: 'Marketing', period: 'H1 2026', reviewer: 'T. Hanks', score: 3.5, status: 'Manager Review', type: 'Bi-Annual' },
  { id: 'REV-26-04', employee: 'Diana Prince', department: 'Engineering', period: 'Q2 2026', reviewer: 'M. Johnson', score: 4.9, status: 'Completed', type: 'Quarterly OKR' },
  { id: 'REV-26-05', employee: 'Ethan Hunt', department: 'Security', period: 'Annual 2025', reviewer: 'Bruce W.', score: 4.2, status: 'Completed', type: 'Annual Review' },
];

export default function PerformanceReviews() {
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [reviews] = useState(MOCK_REVIEWS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReviews = useMemo(() => {
    let filtered = reviews.filter(r => 
      r.employee.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.reviewer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.department.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeTab === 'active') {
      filtered = filtered.filter(r => r.status !== 'Completed');
    } else {
      filtered = filtered.filter(r => r.status === 'Completed');
    }
    return filtered;
  }, [reviews, searchTerm, activeTab]);

  const activeCount = reviews.filter(r => r.status !== 'Completed').length;
  
  const completedReviews = reviews.filter(r => r.status === 'Completed');
  const avgScore = completedReviews.length > 0 
    ? completedReviews.reduce((sum, r) => sum + (r.score || 0), 0) / completedReviews.length 
    : 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Award className="w-6 h-6 text-amber-500" />
            Performance & Appraisals
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Conduct 360-degree feedback, OKR scoring, and annual reviews.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Cycles</span>
             <span className="text-lg font-mono font-bold text-amber-400">{activeCount}</span>
           </div>
           <button className="h-10 px-4 bg-amber-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-amber-700 transition-colors shadow-sm">
             <PlayCircle className="w-4 h-4" /> Start Cycle
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <UserCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Appraisals</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{reviews.length}</div>
          </div>
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-600 mb-2">
              <ListTodo className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Pending Action</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-700">{activeCount}</div>
          </div>
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <CheckSquare className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Completed</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-700">{completedReviews.length}</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-2">
              <Star className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Avg Company Score</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-700">{avgScore.toFixed(1)} <span className="text-lg text-amber-500">/ 5.0</span></div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['active', 'completed'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'active' ? 'Active Appraisals' : 'Completed Reviews'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search employee or reviewer..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[900px]">
              <div className="col-span-3">Employee / Dept</div>
              <div className="col-span-2 text-center">Review Period</div>
              <div className="col-span-2 text-center">Manager / Reviewer</div>
              <div className="col-span-2 text-center">Final Score /5.0</div>
              <div className="col-span-3 text-right">Status & Actions</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[900px]">
              <AnimatePresence>
                {filteredReviews.map((r, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={r.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0 border border-slate-300">
                        {r.employee.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="truncate pr-4">
                        <div className="font-bold text-slate-900 truncate group-hover:text-amber-600 transition-colors">{r.employee}</div>
                        <div className="text-[10px] font-bold text-slate-500 mt-0.5">{r.department}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-2 flex flex-col items-center justify-center">
                       <span className="text-sm font-bold text-slate-700">{r.period}</span>
                       <span className="text-[10px] font-mono text-slate-400 mt-0.5">{r.type}</span>
                    </div>
                    
                    <div className="col-span-2 text-center text-sm font-bold text-slate-700 flex items-center justify-center gap-2">
                       <UserCheck size={14} className="text-slate-400" />
                       {r.reviewer}
                    </div>
                    
                    <div className="col-span-2 flex justify-center">
                       {r.score ? (
                         <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                           <Star size={14} className="text-amber-500 fill-amber-500" />
                           <span className="font-bold font-mono text-amber-700 text-base">{r.score.toFixed(1)}</span>
                         </div>
                       ) : (
                         <span className="text-slate-300 font-mono text-sm">--</span>
                       )}
                    </div>
                    
                    <div className="col-span-3 flex justify-end items-center gap-3">
                       <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                          r.status === 'Completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          r.status === 'Manager Review' ? "bg-blue-50 text-blue-700 border-blue-200" :
                          "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                       )}>
                          {r.status}
                       </span>
                       {r.status !== 'Completed' && (
                         <button className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Add Note / Nudge">
                            <MessageSquare size={16} />
                         </button>
                       )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredReviews.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <Award size={32} className="mx-auto mb-3 text-slate-300" />
                  No {activeTab} appraisals found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/operations/PerformanceReviews.tsx', code);
