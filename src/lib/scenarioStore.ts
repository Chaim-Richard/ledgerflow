import { create } from 'zustand';

export interface GhostTransaction {
  id: string;
  description: string;
  amountCents: number;
  date: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  isActive: boolean;
  type: 'income' | 'expense';
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  ghosts: GhostTransaction[];
  isActive: boolean;
}

interface ScenarioState {
  scenarios: Scenario[];
  activeScenarioId: string | null;
  setScenarios: (scenarios: Scenario[]) => void;
  setActiveScenarioId: (id: string | null) => void;
  addScenario: (name: string, description: string) => void;
  deleteScenario: (id: string) => void;
  toggleScenario: (id: string) => void;
  addGhost: (scenarioId: string, ghost: Omit<GhostTransaction, 'id' | 'isActive'>) => void;
  toggleGhost: (scenarioId: string, ghostId: string) => void;
  deleteGhost: (scenarioId: string, ghostId: string) => void;
}

export const useScenarioStore = create<ScenarioState>((set) => ({
  scenarios: [
    {
      id: 'default-scenario',
      name: 'Base Evolution',
      description: 'The natural trajectory of current operations.',
      ghosts: [],
      isActive: true
    }
  ],
  activeScenarioId: 'default-scenario',

  setScenarios: (scenarios) => set({ scenarios }),
  setActiveScenarioId: (id) => set({ activeScenarioId: id }),

  addScenario: (name, description) => set((state) => ({
    scenarios: [...state.scenarios, {
      id: crypto.randomUUID(),
      name,
      description,
      ghosts: [],
      isActive: false
    }]
  })),

      deleteScenario: (id) => set((state) => ({
        scenarios: state.scenarios.filter(s => s.id !== id),
        activeScenarioId: state.activeScenarioId === id ? null : state.activeScenarioId
      })),

      toggleScenario: (id) => set((state) => ({
        activeScenarioId: id,
        scenarios: state.scenarios.map(s => ({ ...s, isActive: s.id === id }))
      })),

      addGhost: (scenarioId, ghost) => set((state) => ({
        scenarios: state.scenarios.map(s => s.id === scenarioId ? {
          ...s,
          ghosts: [...s.ghosts, { ...ghost, id: crypto.randomUUID(), isActive: true }]
        } : s)
      })),

      toggleGhost: (scenarioId, ghostId) => set((state) => ({
        scenarios: state.scenarios.map(s => s.id === scenarioId ? {
          ...s,
          ghosts: s.ghosts.map(g => g.id === ghostId ? { ...g, isActive: !g.isActive } : g)
        } : s)
      })),

      deleteGhost: (scenarioId, ghostId) => set((state) => ({
        scenarios: state.scenarios.map(s => s.id === scenarioId ? {
          ...s,
          ghosts: s.ghosts.filter(g => g.id !== ghostId)
        } : s)
      }))
    })
);
