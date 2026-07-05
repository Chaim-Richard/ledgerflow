import React, { Suspense } from 'react';
import { motion } from 'motion/react';
import { Database, Loader2 } from 'lucide-react';
import { VIEW_COMPONENTS } from '../../config/registry';
import { LexiconText } from '../../hooks/useLexicon';

interface MainViewSwitcherProps {
  activeTab: string;
  props: any;
}

/**
 * View Switcher
 * Manages the transition between different financial views using the central feature registry.
 */
const MainViewSwitcher = React.memo(({ activeTab, props }: MainViewSwitcherProps) => {
  const Component = VIEW_COMPONENTS[activeTab];

  // Pass the full prop object to all components. They pull what they need from the object properties.
  const componentProps = props;

  return (
    <div className="relative h-full flex-1 flex flex-col w-full">
      <Suspense fallback={
        <div className="h-full flex flex-col items-center justify-center space-y-12 bg-white/50 backdrop-blur-lg rounded-[32px] border border-white mx-10 my-10 relative overflow-hidden">
          <div className="technical-grid absolute inset-0 opacity-[0.05]" />
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            className="w-32 h-32 border-4 border-dashed border-indigo-600/20 rounded-full flex items-center justify-center"
          >
             <Loader2 className="animate-spin text-indigo-600" size={48} />
          </motion.div>
          <div className="text-center space-y-2 relative z-10">
            <LexiconText cardKey="switcher.loadingData" defaultVal="Loading Data" as="h2" className="text-xl font-black text-slate-900 uppercase tracking-[0.6em]" />
            <LexiconText cardKey="switcher.accessingRecords" defaultVal="Accessing Records" className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate opacity-40 block" />
          </div>
        </div>
      }>
        {Component ? (
          <Component {...componentProps} />
        ) : (
          <div className="h-full flex items-center justify-center p-20 border border-white/5 bg-white/[0.02] rounded-[32px] technical-grid">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-600/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Database className="text-indigo-600" size={32} />
              </div>
              <div className="space-y-2">
                <LexiconText cardKey="switcher.viewNotFound" defaultVal="View Not Found" as="h2" className="text-2xl font-black text-slate-900 uppercase tracking-[0.5em]" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] opacity-60">
                  <LexiconText cardKey="switcher.systemIdentity" defaultVal="System identity" /> {activeTab} <LexiconText cardKey="switcher.requiresInit" defaultVal="requires initialization" />
                </p>
              </div>
            </div>
          </div>
        )}
      </Suspense>
    </div>
  );
});

export default MainViewSwitcher;
