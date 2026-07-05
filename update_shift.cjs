const fs = require('fs');
const shiftCode = `import React, { useState } from 'react';
import { CalendarDays, Users, MapPin, Plus, Search, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

const MOCK_SHIFTS = [
  { id: 'S-01', employee: 'Alice Walker', role: 'Store Manager', start: '08:00', end: '16:00', location: 'Downtown Store', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'S-02', employee: 'Bob Smith', role: 'Sales Associate', start: '10:00', end: '18:00', location: 'Downtown Store', color: 'bg-blue-100 text-blue-800' },
  { id: 'S-03', employee: 'Charlie Davis', role: 'Inventory Tech', start: '06:00', end: '14:00', location: 'Main Warehouse', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'S-04', employee: 'Diana Prince', role: 'Support Agent', start: '12:00', end: '20:00', location: 'Call Center', color: 'bg-amber-100 text-amber-800' },
  { id: 'S-05', employee: 'Ethan Hunt', role: 'Security', start: '20:00', end: '04:00', location: 'Downtown Store', color: 'bg-rose-100 text-rose-800' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ShiftScheduling() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'locations'>('schedule');
  const [shifts] = useState(MOCK_SHIFTS);
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredShifts = shifts.filter(s => 
    s.employee.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <CalendarDays className="w-6 h-6 text-purple-400" />
            Shift & Roster Scheduling
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage employee shifts, locations, and coverage requirements.
          </p>
        </div>
        <button className="h-10 px-4 bg-purple-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-purple-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Shift
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        
        {/* Calendar Navigation Bar */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <button className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"><ChevronLeft size={20} /></button>
               <span className="font-bold text-slate-900 w-32 text-center">Week 24 (Jun)</span>
               <button className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"><ChevronRight size={20} /></button>
             </div>
           </div>
           <div className="flex items-center gap-2 relative max-w-xs w-full">
             <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
             <input 
               type="text" 
               placeholder="Search employee or role..." 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
             />
           </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Employee</div>
            <div className="col-span-3 text-center">Shift Hours</div>
            <div className="col-span-3 text-center">Role</div>
            <div className="col-span-3 text-right">Location</div>
          </div>
          
          <div className="divide-y divide-slate-100">
            {filteredShifts.map((s, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={s.id} 
                className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors"
              >
                <div className="col-span-3">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                      {s.employee.split(' ').map(n => n[0]).join('')}
                    </div>
                    {s.employee}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5 ml-10">{s.id}</div>
                </div>
                
                <div className="col-span-3 flex justify-center">
                   <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-700">
                     <Clock size={14} className="text-slate-400" />
                     {s.start} - {s.end}
                   </div>
                </div>

                <div className="col-span-3 flex justify-center">
                   <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider", s.color)}>
                     {s.role}
                   </span>
                </div>

                <div className="col-span-3 flex justify-end text-sm text-slate-700 items-center gap-1.5 font-bold">
                   <MapPin className="w-4 h-4 text-slate-400" /> {s.location}
                </div>
              </motion.div>
            ))}
            {filteredShifts.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                No shifts found for the current search.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/operations/ShiftScheduling.tsx', shiftCode);
