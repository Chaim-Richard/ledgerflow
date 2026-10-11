/** Presentation only: period identities keep current/prior figures together. */
export interface ReportPeriodLayout { order: string[]; hidden: string[] }
export function validPeriodLayout(value: unknown, ids: string[]): ReportPeriodLayout {
  const record = value && typeof value === 'object' ? value as Partial<ReportPeriodLayout> : {};
  const allowed = new Set(ids);
  const order = [...new Set(Array.isArray(record.order) ? record.order.filter(id => typeof id === 'string' && allowed.has(id)) : [])];
  order.push(...ids.filter(id => !order.includes(id)));
  const hidden = [...new Set(Array.isArray(record.hidden) ? record.hidden.filter(id => typeof id === 'string' && allowed.has(id)) : [])];
  if (hidden.length === ids.length && ids.length) hidden.pop();
  return { order, hidden };
}
export function readPeriodLayout(key: string, ids: string[]): ReportPeriodLayout {
  try { return validPeriodLayout(JSON.parse(localStorage.getItem(key) || 'null'), ids); }
  catch { return validPeriodLayout(null, ids); }
}
export function savePeriodLayout(key: string, layout: ReportPeriodLayout): void {
  try { localStorage.setItem(key, JSON.stringify(layout)); } catch { /* device storage unavailable */ }
}
export function movePeriod(layout: ReportPeriodLayout, id: string, direction: -1 | 1): ReportPeriodLayout {
  const order = [...layout.order];
  const index = order.indexOf(id), next = index + direction;
  if (index < 0 || next < 0 || next >= order.length) return layout;
  [order[index], order[next]] = [order[next], order[index]];
  return { ...layout, order };
}
export function visiblePeriods<T extends { period: { id: string } }>(columns: T[], layout: ReportPeriodLayout): T[] {
  const byId = new Map(columns.map(column => [column.period.id, column]));
  return layout.order.filter(id => !layout.hidden.includes(id)).flatMap(id => {
    const column = byId.get(id); return column ? [column] : [];
  });
}
