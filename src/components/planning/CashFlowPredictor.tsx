import React, { useState } from 'react';
import { TrendingUp, Activity, BarChart, Zap, Calendar, ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { doubleExponentialSmoothing } from '../../lib/algorithms/forecasting';

export default function CashFlowPredictor() {
  const [activeTab, setActiveTab] = useState<'forecast' | 'trends'>('forecast');
  
  // Historical cash flow data (monthly net cash flow)
  const historicalData: any[] = [];
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Generate 6-month forecast using Holt's Method (alpha=0.3, beta=0.2)
  const forecast = doubleExponentialSmoothing(historicalData, 0.3, 0.2, 6);
  const forecastMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            Algorithmic Cash Flow Predictor
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Time-series forecasting using Double Exponential Smoothing (Holt's Method).
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 mb-6 w-max">
          {[
            { id: 'forecast', label: 'Predictive Forecast (6-Mo)', icon: Activity },
            { id: 'trends', label: 'Historical Trend', icon: BarChart }
          ].map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                   "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                   activeTab === tab.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
                )}
             >
                <tab.icon className="w-4 h-4" /> {tab.label}
             </button>
          ))}
        </div>

        {activeTab === 'forecast' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
               <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  Forward Predictions (Holt's Method, α=0.3, β=0.2)
               </h2>
            </div>
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-4">Future Period</div>
              <div className="col-span-4 text-right">Predicted Net Cash Flow</div>
              <div className="col-span-4 text-right">Trend Velocity</div>
            </div>
            <div className="divide-y divide-slate-200">
              {forecast.map((val, idx) => {
                 const prevVal = idx === 0 ? historicalData[historicalData.length-1] : forecast[idx-1];
                 const velocity = ((val - prevVal) / prevVal) * 100;
                 return (
                   <div key={idx} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                     <div className="col-span-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-900">2027 {forecastMonths[idx]}</span>
                     </div>
                     <div className="col-span-4 text-right font-mono font-bold text-emerald-600">
                        ${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                     </div>
                     <div className="col-span-4 flex justify-end">
                        <span className={cn(
                           "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1",
                           velocity > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                        )}>
                           <ArrowUpRight className="w-3 h-3" />
                           {velocity > 0 ? '+' : ''}{velocity.toFixed(2)}%
                        </span>
                     </div>
                   </div>
                 );
              })}
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
           <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
             <div className="flex h-64 items-end gap-2 mt-4">
                {historicalData.map((val, idx) => {
                   const max = Math.max(...historicalData);
                   const height = (val / max) * 100;
                   return (
                      <div key={idx} className="flex-1 flex flex-col justify-end items-center gap-2 group relative">
                         <div className="w-full bg-slate-200 rounded-t-sm hover:bg-slate-300 transition-colors relative" style={{ height: `${height}%` }}>
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap pointer-events-none z-10">
                               ${val.toLocaleString()}
                            </div>
                         </div>
                         <div className="text-[10px] font-bold text-slate-500 uppercase">{months[idx]}</div>
                      </div>
                   )
                })}
             </div>
           </div>
        )}
      </div>
    </div>
  );
}
