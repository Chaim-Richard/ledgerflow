import type { AlgorithmDefinition } from './algorithms/types';
/** Presentation wording; computation and registered defaults remain unchanged. */
export function algorithmPurpose(algorithm: AlgorithmDefinition): string {
  return algorithm.id === 'planning_4'
    ? 'Projects cash-flow paths using the selected horizon and simulation count, based on historical cash-account movements.'
    : algorithm.description;
}
