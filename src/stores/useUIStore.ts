import { create } from 'zustand';
import { AppTab } from '../types';

interface UIState {
  activeTab: AppTab;
  isSidebarOpen: boolean;
  isCompactMode: boolean;
  isProMode: boolean;
  isQuickEntryOpen: boolean;
  isCommandPaletteOpen: boolean;
  isImporterOpen: boolean;
  isQBOMigrationOpen: boolean;
  isTemplateSelectorOpen: boolean;
  isAIBlueprintOpen: boolean;
  isCommandCenterOpen: boolean;
  isConverterOpen: boolean;
  isIntegrityOpen: boolean;
  isEntanglementOpen: boolean;
  isDiagnosticConsoleOpen: boolean;
  isGuideOpen: boolean;
  isArchitectureOpen: boolean;
  isFocusMode: boolean;
  isPrivacyMode: boolean;
  isShortcutOverlayOpen: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  language: 'en' | 'he';
  filterCriteria: any | null;
  parsingQueue: Array<{ id: string, name: string, status: 'uploading' | 'parsing' | 'done' | 'error', idempotencyKey?: string }>;
  splittingTxId: string | null;
  isDevMode: boolean;
  theme: 'light' | 'dark' | 'system';
  isQuietMode: boolean;
  activeIntelChannel: string;
  lexiconOverrides: Record<string, { en: string; he: string }>;
  
  setActiveTab: (tab: AppTab) => void;
  setActiveIntelChannel: (channel: string) => void;
  activeSettingsTab: string;
  setActiveSettingsTab: (tab: string) => void;
  activeReportTab: string;
  setActiveReportTab: (tab: string) => void;
  navigateTool: (id: string) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (val: boolean) => void;
  toggleQuietMode: () => void;
  toggleFocusMode: () => void;
  setLanguage: (lang: 'en' | 'he') => void;
  setCompactMode: (val: boolean) => void;
  setProMode: (val: boolean) => void;
  setQuickEntryOpen: (val: boolean) => void;
  setCommandPaletteOpen: (val: boolean) => void;
  setImporterOpen: (val: boolean) => void;
  setTemplateSelectorOpen: (val: boolean) => void;
  setAIBlueprintOpen: (val: boolean) => void;
  setCommandCenterOpen: (val: boolean) => void;
  setConverterOpen: (val: boolean) => void;
  setIntegrityOpen: (val: boolean) => void;
  setEntanglementOpen: (val: boolean) => void;
  setDiagnosticConsoleOpen: (val: boolean) => void;
  setGuideOpen: (val: boolean) => void;
  setArchitectureOpen: (val: boolean) => void;
  togglePrivacyMode: () => void;
  setShortcutOverlayOpen: (val: boolean) => void;
  setFilterCriteria: (val: any | null) => void;
  setIsOnline: (val: boolean) => void;
  setIsSyncing: (val: boolean) => void;
  setParsingQueue: (queue: any[]) => void;
  setSplittingTxId: (id: string | null) => void;
  addParsingItem: (item: { id: string, name: string, status: 'uploading' | 'parsing' | 'done' | 'error', idempotencyKey?: string }) => void;
  updateParsingItem: (id: string, updates: any) => void;
  setDevMode: (val: boolean) => void;
  setLexiconOverride: (key: string, lang: 'en' | 'he', value: string) => void;
  resetLexiconOverrides: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  hiddenTabs: string[];
  toggleTabVisibility: (id: string) => void;
  speedDials: Record<string, string>;
  setSpeedDial: (key: string, tabId: string) => void;
  removeSpeedDial: (key: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: (typeof window !== 'undefined' && window.location.hash) ? 
    (window.location.hash.slice(1) as AppTab) : 'dashboard',
  isSidebarOpen: true,
  isCompactMode: false,
  isProMode: false,
  isQuickEntryOpen: false,
  isCommandPaletteOpen: false,
  isImporterOpen: false,
  isQBOMigrationOpen: false,
  isTemplateSelectorOpen: false,
  isAIBlueprintOpen: false,
  isCommandCenterOpen: false,
  isConverterOpen: false,
  isIntegrityOpen: false,
  isEntanglementOpen: false,
  isDiagnosticConsoleOpen: false,
  isGuideOpen: false,
  isArchitectureOpen: false,
  isFocusMode: false,
  isPrivacyMode: false,
  isShortcutOverlayOpen: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  language: 'en',
  filterCriteria: null,
  parsingQueue: [],
  splittingTxId: null,
  isDevMode: false,
  theme: (() => {
    try {
      return (localStorage.getItem('lf_theme') as 'light' | 'dark' | 'system') || 'system';
    } catch (e) {
      return 'system';
    }
  })(),
  isQuietMode: false,
  activeIntelChannel: 'radar',
  activeSettingsTab: 'billing',
  activeReportTab: 'pnl',
  lexiconOverrides: (() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('lf_lexicon_overrides') : null;
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  })(),
  hiddenTabs: (() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('lf_hidden_tabs') : null;
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  })(),
  speedDials: (() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('lf_speed_dials') : null;
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  })(),

  setActiveIntelChannel: (activeIntelChannel) => set({ activeIntelChannel }),
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
    else if (['billing', 'rule', 'blueprint', 'developer', 'security', 'shortcuts'].includes(id)) {
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
  }),
  setActiveTab: (activeTab) => {
    if (typeof window !== 'undefined' && window.location.hash !== `#${activeTab}`) {
      window.location.hash = activeTab;
    }
    set({ activeTab });
  },
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  toggleQuietMode: () => set((state) => ({ isQuietMode: !state.isQuietMode })),
  toggleFocusMode: () => set((state) => ({ 
    isFocusMode: !state.isFocusMode,
    isSidebarOpen: state.isFocusMode // Open sidebar when leaving focus mode
  })),
  setLanguage: (language) => set({ language }),
  setCompactMode: (isCompactMode) => set({ isCompactMode }),
  setProMode: (isProMode) => set({ isProMode }),
  setQuickEntryOpen: (isQuickEntryOpen) => set({ isQuickEntryOpen }),
  setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
  setImporterOpen: (isImporterOpen) => set({ isImporterOpen }),
  setQBOMigrationOpen: (isQBOMigrationOpen: boolean) => set({ isQBOMigrationOpen }),
  setTemplateSelectorOpen: (isTemplateSelectorOpen) => set({ isTemplateSelectorOpen }),
  setAIBlueprintOpen: (isAIBlueprintOpen) => set({ isAIBlueprintOpen }),
  setCommandCenterOpen: (isCommandCenterOpen) => set({ isCommandCenterOpen }),
  setConverterOpen: (isConverterOpen) => set({ isConverterOpen }),
  setIntegrityOpen: (isIntegrityOpen) => set({ isIntegrityOpen }),
  setEntanglementOpen: (isEntanglementOpen) => set({ isEntanglementOpen }),
  setDiagnosticConsoleOpen: (isDiagnosticConsoleOpen) => set({ isDiagnosticConsoleOpen }),
  setGuideOpen: (isGuideOpen) => set({ isGuideOpen }),
  setArchitectureOpen: (isArchitectureOpen) => set({ isArchitectureOpen }),
  togglePrivacyMode: () => set((state) => ({ isPrivacyMode: !state.isPrivacyMode })),
  setShortcutOverlayOpen: (isShortcutOverlayOpen) => set({ isShortcutOverlayOpen }),
  setFilterCriteria: (filterCriteria) => set({ filterCriteria }),
  setIsOnline: (isOnline) => set({ isOnline }),
  setIsSyncing: (isSyncing) => set({ isSyncing }),
  setParsingQueue: (parsingQueue) => set({ parsingQueue }),
  setSplittingTxId: (splittingTxId) => set({ splittingTxId }),
  addParsingItem: (item) => set((state) => ({ parsingQueue: [...state.parsingQueue, item] })),
  updateParsingItem: (id, updates) => set((state) => ({ 
    parsingQueue: state.parsingQueue.map(i => i.id === id ? { ...i, ...updates } : i) 
  })),
  setDevMode: (val) => set({ isDevMode: val }),
  setTheme: (theme) => {
    try {
      localStorage.setItem('lf_theme', theme);
    } catch (e) {}
    set({ theme });
  },
  setLexiconOverride: (key, lang, value) => set((state) => {
    const existing = state.lexiconOverrides[key] || { en: '', he: '' };
    const nextOverrides = {
      ...state.lexiconOverrides,
      [key]: {
        ...existing,
        [lang]: value
      }
    };
    try {
      localStorage.setItem('lf_lexicon_overrides', JSON.stringify(nextOverrides));
    } catch (e) {}
    return { lexiconOverrides: nextOverrides };
  }),
  resetLexiconOverrides: () => set(() => {
    try {
      localStorage.removeItem('lf_lexicon_overrides');
    } catch (e) {}
    return { lexiconOverrides: {} };
  }),
  toggleTabVisibility: (id) => set((state) => {
    const isHidden = state.hiddenTabs.includes(id);
    const nextHidden = isHidden
      ? state.hiddenTabs.filter(x => x !== id)
      : [...state.hiddenTabs, id];
    try {
      localStorage.setItem('lf_hidden_tabs', JSON.stringify(nextHidden));
    } catch (e) {}
    return { hiddenTabs: nextHidden };
  }),
  setSpeedDial: (key, tabId) => set((state) => {
    const nextSpeedDials = { ...state.speedDials, [key]: tabId };
    try {
      localStorage.setItem('lf_speed_dials', JSON.stringify(nextSpeedDials));
    } catch (e) {}
    return { speedDials: nextSpeedDials };
  }),
  removeSpeedDial: (key) => set((state) => {
    const { [key]: _, ...nextSpeedDials } = state.speedDials;
    try {
      localStorage.setItem('lf_speed_dials', JSON.stringify(nextSpeedDials));
    } catch (e) {}
    return { speedDials: nextSpeedDials };
  })
}));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1) as AppTab;
    if (hash && useUIStore.getState().activeTab !== hash) {
      useUIStore.setState({ activeTab: hash });
    }
  });

  window.addEventListener('online', () => {
    useUIStore.getState().setIsOnline(true);
  });
  window.addEventListener('offline', () => {
    useUIStore.getState().setIsOnline(false);
  });
}
