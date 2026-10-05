/** Item categories (K-12 BA-05): the categories in use and what renaming one changes. */

export interface CategoryCount { name: string; count: number }

const clean = (category: string | undefined) => (category || '').trim();

/** Categories in use with how many items each has, by name (blank categories left out). */
export function categoryCounts(items: Array<{ category?: string }>): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = clean(item.category);
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The items to change when a category is renamed: every item in `from` (compared without outer
 * spaces). Renaming to an existing category merges the two; renaming to blank removes it.
 */
export function renameCategoryPlan<T extends { id: string; category?: string }>(items: T[], from: string, to: string): { ids: string[]; to: string; merges: boolean } {
  const source = clean(from);
  const target = clean(to);
  if (!source || source === target) return { ids: [], to: target, merges: false };
  const ids = items.filter(i => clean(i.category) === source).map(i => i.id);
  const merges = !!target && items.some(i => clean(i.category) === target);
  return { ids, to: target, merges };
}
