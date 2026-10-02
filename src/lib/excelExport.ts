import { calendarDateISO } from './utils';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExportToExcelOptions {
  sheetName?: string;
  fileName?: string;
  titleRows?: (string | number | null | undefined)[][];
}

/**
 * Creates a raw initialized ExcelJS workbook.
 */
export async function createWorkbook(): Promise<any> {
  const ExcelJS = await import('exceljs');
  return new ExcelJS.Workbook();
}

/**
 * Downloads an ExcelJS workbook in the browser environment.
 */
export async function downloadWorkbook(workbook: any, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Creates an initialized ExcelJS workbook and worksheet with columns configured.
 */
export async function createStyledWorkbook(
  sheetName: string,
  columns: ExcelColumn[]
): Promise<{ workbook: any; worksheet: any }> {
  const workbook = await createWorkbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.columns = columns.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width || 20
  }));
  return { workbook, worksheet };
}

/**
 * Reads 2D rows from an Excel file ArrayBuffer.
 */
export async function parseExcelToRows(data: ArrayBuffer): Promise<any[][]> {
  const workbook = await createWorkbook();
  await workbook.xlsx.load(data);
  const worksheet = workbook.worksheets[0];
  const rows: any[][] = [];
  if (worksheet) {
    worksheet.eachRow((row: any) => {
      const rowData: any[] = [];
      if (Array.isArray(row.values)) {
        // row.values is 1-indexed in ExcelJS
        for (let i = 1; i < row.values.length; i++) {
          let val = row.values[i];
          if (val && typeof val === 'object') {
            if ('result' in val) val = val.result;
            else if (val instanceof Date) val = calendarDateISO(val);
          }
          rowData.push(val || '');
        }
      }
      rows.push(rowData);
    });
  }
  return rows;
}

/**
 * One-shot export helper: creates workbook, populates title rows, columns, data rows, and triggers download.
 */
export async function exportToExcel(
  columns: ExcelColumn[],
  rows: (Record<string, any> | (string | number | null | undefined)[])[],
  options?: ExportToExcelOptions
): Promise<void> {
  const sheetName = options?.sheetName || 'Report';
  const fileName = options?.fileName || `${sheetName.replace(/\s+/g, '_')}_export.xlsx`;

  const { workbook, worksheet } = await createStyledWorkbook(sheetName, columns);

  if (options?.titleRows && options.titleRows.length > 0) {
    for (const titleRow of options.titleRows) {
      worksheet.addRow(titleRow);
    }
    worksheet.addRow([]);
  }

  for (const row of rows) {
    worksheet.addRow(row);
  }

  await downloadWorkbook(workbook, fileName);
}
