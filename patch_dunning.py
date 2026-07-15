import re

with open('src/components/finance/DunningCollections.tsx', 'w') as f:
    f.write("""import React, { useState } from 'react';
import { MailWarning, Send, Plus, Filter, Users, Calendar, ArrowRight, ShieldAlert, BadgeDollarSign, ChevronRight, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { motion } from 'motion/react';

export default function DunningCollections() {
  const transactions = useLedgerStore(state => state.transactions);
  const accounts = useLedgerStore(state => state.accounts);
  const [activeTab, setActiveTab] = useState<'workflows' | 'overdue' | 'communications'>('workflows');
  
  // Fake overdue data extracted from AR
  const arAccount = accounts.find(a => a.name.includes('Accounts Receivable') || a.id === '1200');
  const outstandingInvoices = [
    { id: 'INV-4029', customer: 'Acme Corp', amount: 14500, daysOverdue: 45, status: 'Level 2 Escalation', lastContact: '2023-10-15', probability: 'High Risk' },
    { id: 'INV-4102', customer: 'Global Tech LLC', amount: 8200, daysOverdue: 12, status: 'Friendly Reminder', lastContact: '2023-10-28', probability: 'Low Risk' },
    { id: 'INV-3982', customer: 'Stark Industries', amount: 45000, daysOverdue: 92, status: 'Collection Agency', lastContact: '2023-09-01', probability: 'Critical Risk' },
    { id: 'INV-4155', customer: 'Wayne Enterprises', amount: 3200, daysOverdue: 5, status: 'Initial Notice', lastContact: '-', probability: 'Low Risk' }
  ];
  
  const workflows = [
    { level: 1, name: 'Friendly Reminder', days: 5, action: 'Email', template: 'Reminder Template 1', automated: true },
    { level: 2, name: 'Firm Notice', days: 30, action: 'Email & SMS', template: 'Notice Template 2', automated: true },
    { level: 3, name: 'Final Warning', days: 60, action: 'Certified Mail', template: 'Legal Warning', automated: false },
    { level: 4, name: 'Collections Transfer', days: 90, action: 'External API', template: 'Transfer to Agency', automated: false },
  ];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <MailWarning className="w-6 h-6 text-rose-400" />
            Dunning & Accounts Receivable Automation
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Automate overdue invoice reminders, escalate collections, and probabilistically track bad debt.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-md hover:bg-slate-700 text-sm font-medium transition-colors">
            Configure Email Server
          </button>
          <button className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 text-sm font-medium flex items-center">
            <Send className="w-4 h-4 mr-2" />
            Run Dunning Batch
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 bg-white px-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'workflows', name: 'Dunning Workflows' },
            { id: 'overdue', name: 'Overdue Invoices' },
            { id: 'communications', name: 'Communication Log' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                activeTab === tab.id
                  ? "border-rose-500 text-rose-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {activeTab === 'workflows' && (
          <div className="space-y-6 max-w-5xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">Escalation Matrix</h3>
              <button className="text-sm font-medium text-indigo-600 flex items-center hover:text-indigo-800">
                <Plus className="w-4 h-4 mr-1" />
                Add Escalation Level
              </button>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-200 bg-gray-50 grid grid-cols-12 gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="col-span-1">Level</div>
                <div className="col-span-3">Trigger (Days Overdue)</div>
                <div className="col-span-3">Action Type</div>
                <div className="col-span-3">Message Template</div>
                <div className="col-span-2 text-right">Automation</div>
              </div>
              <div className="divide-y divide-gray-100">
                {workflows.map((wf, idx) => (
                  <div key={idx} className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-gray-50 transition-colors">
                    <div className="col-span-1">
                      <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
                        {wf.level}
                      </span>
                    </div>
                    <div className="col-span-3 flex items-center text-sm font-medium text-gray-900">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      +{wf.days} Days
                    </div>
                    <div className="col-span-3 text-sm text-gray-600 flex items-center">
                      <MailWarning className="w-4 h-4 text-rose-400 mr-2" />
                      {wf.action}
                    </div>
                    <div className="col-span-3 text-sm text-gray-600 flex items-center">
                      {wf.template}
                    </div>
                    <div className="col-span-2 text-right">
                      {wf.automated ? (
                         <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                           <CheckCircle2 className="w-3 h-3 mr-1" /> Auto
                         </span>
                      ) : (
                         <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                           Manual Review
                         </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start mt-6">
              <ShieldAlert className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">Machine Learning Bad Debt Prediction</h4>
                <p className="text-sm text-blue-700 mt-1">
                  The system uses historically trained logistic regression to flag high-risk invoices early, bypassing lower-level friendly reminders when a customer historically defaults on 30+ day windows.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'overdue' && (
          <div className="space-y-4">
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Overdue</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workflow Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI Default Risk</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {outstandingInvoices.map((inv, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-indigo-600">{inv.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{inv.customer}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">${inv.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <span className={cn(
                            "inline-flex px-2 py-1 rounded-md font-medium text-xs",
                            inv.daysOverdue > 60 ? "bg-rose-100 text-rose-800" :
                            inv.daysOverdue > 30 ? "bg-amber-100 text-amber-800" : "bg-yellow-100 text-yellow-800"
                          )}>
                            {inv.daysOverdue} Days
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{inv.status}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                           <span className={cn(
                             "inline-flex items-center",
                             inv.probability === 'Critical Risk' ? 'text-rose-600' :
                             inv.probability === 'High Risk' ? 'text-amber-600' : 'text-green-600'
                           )}>
                             {inv.probability}
                           </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded-md">
                            Escalate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
""")

