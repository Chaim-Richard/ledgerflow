import React, { Suspense } from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { VIEW_COMPONENTS } from '../../config/registry';
import { LexiconText } from '../../hooks/useLexicon';
import { useSystemProps } from '../../hooks/useSystemContext';

interface MainViewSwitcherProps {
  activeTab: string;
}

const MainViewSwitcher = React.memo(({ activeTab }: MainViewSwitcherProps) => {
  const Component = VIEW_COMPONENTS[activeTab];
  const props = useSystemProps(() => {}); // Minimal handle action stub

  return (
    <div className="relative h-full flex-1 flex flex-col w-full">
      <Suspense fallback={
        <div className="h-full flex flex-col items-center justify-center space-y-6">
          <Loader2 className="animate-spin text-gray-300" size={32} />
          <div className="text-center space-y-2">
            <span className="text-sm font-medium text-gray-500">Loading module...</span>
          </div>
        </div>
      }>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
          className="flex-1 flex flex-col h-full w-full"
        >
          {Component ? <Component {...props} /> : (
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
    </div>
  );
});

MainViewSwitcher.displayName = 'MainViewSwitcher';
export default MainViewSwitcher;
