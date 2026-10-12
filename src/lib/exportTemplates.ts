import { validPeriodLayout, type ReportPeriodLayout } from './reportPeriodLayout';

export interface ExportTemplate { name: string; columns: string[]; layout: ReportPeriodLayout }
export const MAX_EXPORT_TEMPLATES = 20;
export const exportTemplateKey = (user: string, workspace: string, report: string) => JSON.stringify(['lf_export_templates_v1', user, workspace, report]);
export function parseExportTemplates(raw: string | null): ExportTemplate[] {
  try {
    const value: unknown = JSON.parse(raw || 'null');
    if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1 || !Array.isArray((value as { templates?: unknown }).templates)) return [];
    const names = new Set<string>();
    return ((value as { templates: unknown[] }).templates).flatMap(item => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Partial<ExportTemplate>;
      if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 80 || names.has(row.name) || !Array.isArray(row.columns) || !row.columns.length || row.columns.length > 500 || !row.columns.every(column => typeof column === 'string' && column.length <= 300)) return [];
      names.add(row.name);
      return [{ name: row.name, columns: row.columns, layout: validPeriodLayout(row.layout, row.columns.map((_, index) => String(index))) }];
    }).slice(0, MAX_EXPORT_TEMPLATES);
  } catch { return []; }
}
export function templateMatches(template: ExportTemplate, columns: string[]): boolean {
  return JSON.stringify(template.columns) === JSON.stringify(columns);
}
