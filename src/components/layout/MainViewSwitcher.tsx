import React, { Suspense } from 'react';
import { motion } from 'motion/react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { VIEW_COMPONENTS } from '../../config/registry';
import { LexiconText } from '../../hooks/useLexicon';
import { useCommandDispatcher } from '../../hooks/useSystemContext';

class ModuleErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4 text-center h-full">
          <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-[32px] flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-lg font-medium text-[var(--text)]">Module Failed to Load</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md">There was a problem loading this module. This may be due to a network error or missing plugin.</p>
          </div>
          <button onClick={() => this.setState({hasError: false})} className="btn-secondary text-sm">Retry Loading</button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface MainViewSwitcherProps {
  activeTab: string;
}

const MainViewSwitcher = React.memo(({ activeTab }: MainViewSwitcherProps) => {
  const Component = VIEW_COMPONENTS[activeTab];
  const { handleAction } = useCommandDispatcher();
  
  return (
    <div className="relative flex-1 flex flex-col w-full min-h-full">
      <ModuleErrorBoundary>
        <Suspense fallback={
          <div className="min-h-full flex flex-col items-center justify-center space-y-6 flex-1">
            <Loader2 className="animate-spin text-slate-300" size={32} />
            <div className="text-center space-y-2">
              <span className="text-sm font-medium text-slate-500">Loading module...</span>
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
                  <h2 className="text-xl font-medium text-black">Module under construction</h2>
                  <p className="text-gray-500 mt-2 text-sm">The {activeTab} view is currently being updated.</p>
                </div>
              </div>
            )}
          </motion.div>
        </Suspense>
      </ModuleErrorBoundary>
    </div>
  );
});

MainViewSwitcher.displayName = 'MainViewSwitcher';
export default MainViewSwitcher;
