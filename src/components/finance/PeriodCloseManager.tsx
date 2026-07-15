import React, { useState } from 'react';
import { CheckCircle2, Lock, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function PeriodCloseManager() {
  const [selectedPeriod, setSelectedPeriod] = useState('2024-06');
  
  const closeSteps: any[] = [];

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-8 py-6 border-b border-[#E5E5E5] flex justify-between items-start bg-[#FAFAFA]">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <Lock className="w-6 h-6 text-rose-600" />
            Period Close Manager
          </h1>
          <p className="text-sm text-[#525252] mt-1">Structured workflows to ensure accurate month-end financial reporting.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="h-10 px-4 bg-white border border-[#E5E5E5] rounded-xl text-sm font-bold focus:outline-none focus:border-[#0A0A0A]"
          >
            <option value="2024-07">July 2024 (Open)</option>
            <option value="2024-06">June 2024 (Closing)</option>
            <option value="2024-05">May 2024 (Locked)</option>
          </select>
          <button className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A]">
            <CheckCircle2 className="w-4 h-4" />
            Close Period
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 max-w-5xl mx-auto w-full">
        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-[#525252] mb-4">
            <span>Period Close Progress</span>
            <span>20% Complete</span>
          </div>
          <div className="h-3 w-full bg-[#FAFAFA] rounded-full overflow-hidden border border-[#E5E5E5]">
            <div className="h-full bg-rose-600 w-1/5" />
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#0A0A0A] mb-4">Closing Checklist ({selectedPeriod})</h2>
          
          {closeSteps.map((step, index) => (
            <div key={step.id} className={cn(
              "p-6 rounded-2xl border transition-all flex items-start gap-6",
              step.status === 'completed' ? "bg-[#FAFAFA] border-[#E5E5E5]" :
              step.status === 'warning' ? "bg-amber-50 border-amber-200" :
              "bg-white border-[#E5E5E5] hover:border-[#A3A3A3] cursor-pointer shadow-sm"
            )}>
              <div className="shrink-0 mt-1">
                {step.status === 'completed' ? (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                ) : step.status === 'warning' ? (
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                ) : step.status === 'locked' ? (
                  <div className="w-8 h-8 rounded-full bg-[#E5E5E5] flex items-center justify-center">
                    <Lock className="w-5 h-5 text-[#525252]" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full border-2 border-[#E5E5E5] flex items-center justify-center text-xs font-bold text-[#A3A3A3]">
                    {index + 1}
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <h3 className="text-base font-bold text-[#0A0A0A] mb-1">{step.name}</h3>
                <p className="text-sm text-[#525252]">{step.description}</p>
              </div>

              <div className="shrink-0 flex items-center h-full mt-2">
                {step.status === 'completed' ? (
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Done</span>
                ) : step.status === 'warning' ? (
                  <button className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-bold hover:bg-amber-200 transition-colors">
                    Review Variance
                  </button>
                ) : (
                  <button className="px-4 py-2 bg-[#FAFAFA] border border-[#E5E5E5] text-[#0A0A0A] rounded-lg text-sm font-bold hover:bg-white transition-colors">
                    Start Task
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
