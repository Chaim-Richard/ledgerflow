import React, { Suspense } from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { VIEW_COMPONENTS } from '../../config/registry';
import { useCommandDispatcher } from '../../hooks/useSystemContext';
import { ViewErrorBoundary } from '../common/ViewErrorBoundary';

interface MainViewSwitcherProps {
  activeTab: string;
}

const MainViewSwitcher = React.memo(({ activeTab }: MainViewSwitcherProps) => {
  const Component = VIEW_COMPONENTS[activeTab];
  useCommandDispatcher();
  
  return (
    <div className="relative flex-1 flex flex-col w-full min-h-full">
      <ViewErrorBoundary key={activeTab} viewName={activeTab}>
        <Suspense fallback={
          <div className="min-h-full flex flex-col items-center justify-center space-y-6 flex-1">
            <Loader2 className="animate-spin text-slate-300" size={32} />
            <div className="text-center space-y-2">
              <span className="text-sm font-medium text-[var(--muted)]">Loading…</span>
            </div>
          </div>
        }>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col w-full min-h-full"
          >
            {Component ? <Component /> : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-4">🚧</div>
                  <h2 className="text-xl font-medium text-[var(--text)]">Module under construction</h2>
                  <p className="text-[var(--muted)] mt-2 text-sm">The {activeTab} view is currently being updated.</p>
                </div>
              </div>
            )}
          </motion.div>
        </Suspense>
      </ViewErrorBoundary>
    </div>
  );
});

MainViewSwitcher.displayName = 'MainViewSwitcher';
export default MainViewSwitcher;
