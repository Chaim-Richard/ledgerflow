const fs = require('fs');

let store = fs.readFileSync('src/stores/useUIStore.ts', 'utf8');

// Add to UIState interface
store = store.replace(
  'setActiveIntelChannel: (channel: string) => void;',
  `setActiveIntelChannel: (channel: string) => void;
  activeSettingsTab: string;
  setActiveSettingsTab: (tab: string) => void;
  activeReportTab: string;
  setActiveReportTab: (tab: string) => void;
  navigateTool: (id: string) => void;`
);

// Add to default state
store = store.replace(
  "activeIntelChannel: 'radar',",
  `activeIntelChannel: 'radar',
  activeSettingsTab: 'billing',
  activeReportTab: 'pnl',`
);

// Add methods
store = store.replace(
  'setActiveIntelChannel: (activeIntelChannel) => set({ activeIntelChannel }),',
  `setActiveIntelChannel: (activeIntelChannel) => set({ activeIntelChannel }),
  setActiveSettingsTab: (activeSettingsTab) => set({ activeSettingsTab }),
  setActiveReportTab: (activeReportTab) => set({ activeReportTab }),
  navigateTool: (id: string) => set((state) => {
    // Basic heuristics:
    const s = { ...state };
    
    // Check Intelligence & Lenses
    if (['radar', 'roi', 'signals', 'yield', 'burn', 'fx-exposure', 'growth-model', 'working-capital', 'pricing-optimizer', 'valuation'].includes(id)) {
      s.activeTab = 'intelligence' as any;
      s.activeIntelChannel = id;
    }
    // Check Settings
    else if (['billing', 'neural', 'blueprint', 'developer', 'security', 'shortcuts'].includes(id)) {
      s.activeTab = 'settings' as any;
      s.activeSettingsTab = id;
    }
    // Check Reports
    else if (['pnl', 'balance-sheet', 'cash-flow', 'trial-balance', 'general-ledger', 'tax', 'segment', 'compliance', 'financial-goals', 'ratios', 'profitability', 'forecast'].includes(id)) {
      s.activeTab = 'reports' as any;
      s.activeReportTab = id;
    }
    // Default to main tab
    else {
      s.activeTab = id as any;
    }
    
    if (typeof window !== 'undefined') {
      window.location.hash = s.activeTab;
    }
    
    return s;
  }),`
);

fs.writeFileSync('src/stores/useUIStore.ts', store);
