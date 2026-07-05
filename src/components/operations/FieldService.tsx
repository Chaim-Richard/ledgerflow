import React, { useState, useMemo } from 'react';
import { Truck, MapPin, Wrench, Calendar, CheckCircle2, Search, Plus, Map, Users, Target } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';





export default function FieldService() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'technicians'>('schedule');
  const [jobs, setJobs] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'jobs'), (snap) => {
      if (!snap.empty) {
        setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setJobs([]);
      }
    });
    return unsub;
  }, []);
  const [techs, setTechs] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'techs'), (snap) => {
      if (!snap.empty) {
        setTechs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setTechs([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredJobs = useMemo(() => {
    return jobs.filter(j => 
      j.customer.toLowerCase().includes(searchTerm.toLowerCase()) || 
      j.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [jobs, searchTerm]);

  const filteredTechs = useMemo(() => {
    return techs.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.skills.join(' ').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [techs, searchTerm]);

  const activeJobs = jobs.filter(j => j.status === 'In Progress' || j.status === 'Dispatched').length;
  const availableTechs = techs.filter(t => t.status === 'Available').length;
  const unassignedJobs = jobs.filter(j => j.tech === 'Unassigned').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Truck className="w-6 h-6 text-orange-400" />
            Field Service Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Dispatch technicians, track service routes, and manage work orders.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available Techs</span>
             <span className="text-lg font-mono font-bold text-emerald-400">{availableTechs} / {techs.length}</span>
           </div>
           <button className="h-10 px-4 bg-orange-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> New Work Order
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Calendar className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Scheduled Today</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{jobs.filter(j => j.date === '2026-07-04').length}</div>
          </div>
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <Map className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Active Routes</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-700">{activeJobs}</div>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <Target className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Unassigned Jobs</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{unassignedJobs}</div>
          </div>
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-500 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Completed (Week)</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-600">{jobs.filter(j => j.status === 'Completed').length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {[
                 { id: 'schedule', label: 'Work Orders & Schedule', icon: Calendar },
                 { id: 'technicians', label: 'Technician Roster', icon: Wrench }
               ].map(tab => (
                 <button 
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                     activeTab === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   <tab.icon className="w-3.5 h-3.5" />
                   {tab.label}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder={activeTab === 'schedule' ? "Search work orders..." : "Search technicians..."}
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'schedule' ? (
              <>
                <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[900px]">
                  <div className="col-span-2">Date / Time</div>
                  <div className="col-span-3">Work Order & Customer</div>
                  <div className="col-span-3">Location</div>
                  <div className="col-span-2">Technician</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>
                
                <div className="divide-y divide-slate-100 min-w-[900px]">
                  <AnimatePresence>
                    {filteredJobs.map((job, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={job.id} 
                        className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <div className="col-span-2">
                           <div className="text-sm font-bold font-mono text-slate-900">{job.time}</div>
                           <div className="text-[10px] font-mono text-slate-500">{job.date}</div>
                        </div>
                        
                        <div className="col-span-3">
                          <div className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors truncate">{job.customer}</div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">{job.id} • {job.type}</div>
                        </div>
                        
                        <div className="col-span-3 text-xs text-slate-600 flex items-center gap-1.5 truncate pr-4">
                           <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {job.location}
                        </div>
                        
                        <div className="col-span-2">
                           <span className={cn(
                             "text-xs font-bold px-2 py-1 rounded-md", 
                             job.tech === 'Unassigned' ? "text-rose-600 bg-rose-50 border border-rose-200" : "text-slate-700 bg-slate-100 border border-slate-200"
                           )}>
                              {job.tech}
                           </span>
                        </div>
                        
                        <div className="col-span-2 flex justify-end">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            job.status === 'In Progress' ? "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse" :
                            job.status === 'Dispatched' ? "bg-blue-50 text-blue-700 border-blue-200" :
                            job.status === 'Completed' ? "bg-slate-100 text-slate-500 border-slate-200" :
                            "bg-rose-50 text-rose-700 border-rose-200"
                          )}>
                            {job.status}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {filteredJobs.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <Calendar size={32} className="mx-auto mb-3 text-slate-300" />
                      No scheduled jobs found.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                  <div className="col-span-3">Technician</div>
                  <div className="col-span-4">Skills & Certifications</div>
                  <div className="col-span-3">Current Location / Assignment</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>
                
                <div className="divide-y divide-slate-100 min-w-[800px]">
                  <AnimatePresence>
                    {filteredTechs.map((tech, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={tech.id} 
                        className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <div className="col-span-3 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0 border border-slate-300">
                             {tech.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="truncate pr-4">
                            <div className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors truncate">{tech.name}</div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">{tech.id}</div>
                          </div>
                        </div>
                        
                        <div className="col-span-4 flex flex-wrap gap-1.5">
                           {tech.skills.map((skill: any, idx: any) => (
                             <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold border border-slate-200">
                               {skill}
                             </span>
                           ))}
                        </div>
                        
                        <div className="col-span-3">
                           <div className="text-xs text-slate-700 flex items-center gap-1.5 font-medium truncate pr-4">
                              <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {tech.location}
                           </div>
                           {tech.currentJob && (
                             <div className="text-[10px] font-mono text-slate-500 mt-1 ml-5 flex items-center gap-1">
                               <Target size={10} /> {tech.currentJob}
                             </div>
                           )}
                        </div>
                        
                        <div className="col-span-2 flex justify-end">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            tech.status === 'Available' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            tech.status === 'En Route' ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                          )}>
                            {tech.status}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {filteredTechs.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <Users size={32} className="mx-auto mb-3 text-slate-300" />
                      No technicians found.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
