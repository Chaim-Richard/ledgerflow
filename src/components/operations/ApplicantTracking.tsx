import React, { useState } from 'react';
import { Users, Target } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ApplicantTracking() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'candidates'>('candidates');

  const candidates = [
    { id: 'CAN-001', name: 'Alice Walker', role: 'Senior Developer', stage: 'Interview', date: '2025-10-15', score: 92 },
    { id: 'CAN-002', name: 'Bob Smith', role: 'Account Executive', stage: 'Offer', date: '2025-10-18', score: 88 },
    { id: 'CAN-003', name: 'Charlie Davis', role: 'Marketing Mgr', stage: 'Screening', date: '2025-10-20', score: 75 },
  ];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Users className="w-6 h-6 text-pink-400" />
            Applicant Tracking (ATS)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage job postings, candidate pipelines, and hiring workflows.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 mb-6 w-max">
          {[
            { id: 'candidates', label: 'Candidates', icon: Users },
            { id: 'jobs', label: 'Job Openings', icon: Target }
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

        {activeTab === 'candidates' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">Candidate</div>
              <div className="col-span-3">Applied Role</div>
              <div className="col-span-2 text-center">Score</div>
              <div className="col-span-2 text-center">Applied</div>
              <div className="col-span-2 text-right">Stage</div>
            </div>
            <div className="divide-y divide-slate-200">
              {candidates.map(can => (
                <div key={can.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-3">
                    <div className="font-bold text-slate-900">{can.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{can.id}</div>
                  </div>
                  <div className="col-span-3 text-sm font-bold text-slate-700">
                    {can.role}
                  </div>
                  <div className="col-span-2 text-center">
                     <span className="font-bold font-mono text-slate-700">{can.score}%</span>
                  </div>
                  <div className="col-span-2 text-center text-xs font-mono text-slate-500">
                     {can.date}
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      can.stage === 'Offer' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      can.stage === 'Interview' ? "bg-blue-50 text-blue-700 border-blue-200" :
                      "bg-slate-100 text-slate-700 border-slate-200"
                    )}>
                      {can.stage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
