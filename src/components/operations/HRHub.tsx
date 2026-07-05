import React, { useState } from 'react';
import { Users, UserPlus, Heart, Award, Search, Filter, Plus, FileText, CalendarDays, ArrowRight, DollarSign, Briefcase } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function HRHub() {
  const [activeTab, setActiveTab] = useState<'directory' | 'recruitment' | 'timeoff'>('directory');
  
  const mockEmployees: any[] = [];

  const totalPayroll = mockEmployees.reduce((sum, e) => sum + e.salary, 0);

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-white border-b border-[#E5E5E5] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <Users className="w-6 h-6 text-pink-600" />
            HR & Talent Management
          </h1>
          <p className="text-sm text-[#525252] mt-1">
            Enterprise Human Resources. Track org structure, compensation, and team logistics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search employees..."
              className="w-64 h-10 pl-9 pr-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>
          <button className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI Dashboard */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Total Headcount</span>
              <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-pink-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">{mockEmployees.length}</div>
            <div className="mt-4 text-[10px] font-bold text-[#525252] uppercase tracking-wider flex justify-between">
              <span>FT: {mockEmployees.filter(e => e.type === 'Full-Time').length}</span>
              <span>CT: {mockEmployees.filter(e => e.type === 'Contractor').length}</span>
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Annual Payroll Base</span>
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">${(totalPayroll).toLocaleString()}</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Open Roles</span>
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">3</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">On Leave</span>
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <Heart className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">{mockEmployees.filter(e => e.status === 'On Leave').length}</div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex p-1 bg-white border border-[#E5E5E5] rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'directory', label: 'Employee Directory', icon: Users },
            { id: 'recruitment', label: 'Recruitment & ATS', icon: UserPlus },
            { id: 'timeoff', label: 'Time Off & Benefits', icon: CalendarDays }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                activeTab === tab.id ? "bg-[#0A0A0A] text-white" : "text-[#525252] hover:bg-[#F5F5F5]"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {activeTab === 'directory' && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-[#FAFAFA] border-b border-[#E5E5E5] text-[10px] font-bold text-[#525252] uppercase tracking-wider">
              <div className="col-span-1">ID</div>
              <div className="col-span-3">Employee Name</div>
              <div className="col-span-3">Role & Dept</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2 text-right">Base Salary</div>
              <div className="col-span-1 text-right">Status</div>
            </div>
            <div className="divide-y divide-[#E5E5E5]">
              {mockEmployees.map((emp) => (
                <div key={emp.id} className="grid grid-cols-12 p-4 items-center hover:bg-[#FAFAFA] transition-colors cursor-pointer group">
                  <div className="col-span-1 font-mono text-xs font-bold text-[#A3A3A3]">{emp.id}</div>
                  <div className="col-span-3">
                    <div className="font-bold text-[#0A0A0A]">{emp.name}</div>
                    <div className="text-xs text-[#525252] flex items-center gap-1 mt-0.5">
                      Hire Date: {emp.hireDate}
                    </div>
                  </div>
                  <div className="col-span-3">
                    <div className="font-medium text-[#0A0A0A] text-sm">{emp.role}</div>
                    <div className="text-xs font-bold text-pink-600 uppercase tracking-wider mt-0.5">{emp.dept}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="px-2 py-1 bg-[#FAFAFA] border border-[#E5E5E5] rounded text-xs font-bold text-[#525252]">
                      {emp.type}
                    </span>
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-[#0A0A0A]">
                    ${(emp.salary).toLocaleString()}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                      emp.status === 'Active' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {emp.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab !== 'directory' && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center shadow-sm">
            <UserPlus className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#0A0A0A]">Module Under Expansion</h3>
            <p className="text-[#525252] mt-2 max-w-md mx-auto">
              This specialized HR module is currently being built out for enterprise usage.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
