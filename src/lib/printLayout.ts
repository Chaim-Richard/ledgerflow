/**
 * A-218: the paper a report prints on.
 *
 * A browser's print dialog decides the physical page, but a report can say what it needs: an A4
 * sheet for a European or Israeli office, US Letter for a North-American one, and landscape when
 * the table has more columns than a portrait sheet holds without squeezing them. The rule this
 * module builds is a plain CSS `@page` rule injected while the screen is open; nothing here is
 * saved to the books and no amount is computed.
 *
 * Kept pure (string in, string out) so the rules can be checked without a browser.
 */
export type PrintPaper = 'a4' | 'letter';
export type PrintOrientation = 'portrait' | 'landscape';

export interface PrintPaperSize {
  value: PrintPaper;
  label: string;
  /** the CSS `size:` keyword browsers understand */
  cssName: string;
  widthMm: number;
  heightMm: number;
}

export const PRINT_PAPER_SIZES: readonly PrintPaperSize[] = [
  { value: 'a4', label: 'A4 (210 × 297 mm)', cssName: 'A4', widthMm: 210, heightMm: 297 },
  { value: 'letter', label: 'US Letter (8.5 × 11 in)', cssName: 'Letter', widthMm: 215.9, heightMm: 279.4 },
];

/** The margin every printed screen already uses (src/index.css `@page { margin: 12mm }`). */
export const PRINT_MARGIN_MM = 12;

/** Where the chosen paper is remembered; a browser-only preference, not a workspace setting. */
export const PRINT_PAPER_STORAGE_KEY = 'lf_print_paper';

export function paperSize(paper: PrintPaper): PrintPaperSize {
  return PRINT_PAPER_SIZES.find(p => p.value === paper) || PRINT_PAPER_SIZES[0];
}

export function isPrintPaper(value: unknown): value is PrintPaper {
  return value === 'a4' || value === 'letter';
}

/**
 * How many columns fit across a portrait sheet at ~9pt with a readable amount column.
 * A4 portrait is 186 mm of print width after the 12 mm margins; six columns of ~31 mm each is the
 * point where amounts still print whole. Wider tables turn the sheet instead of cutting columns.
 */
export const PORTRAIT_COLUMN_LIMIT = 6;

export function choosePrintOrientation(columnCount: number): PrintOrientation {
  const columns = Number.isFinite(columnCount) && columnCount > 0 ? Math.floor(columnCount) : 0;
  return columns > PORTRAIT_COLUMN_LIMIT ? 'landscape' : 'portrait';
}

/** The `@page` rule for a paper and an orientation; `size` also lets a PDF print-to-file obey it. */
export function printPageRule(paper: PrintPaper, orientation: PrintOrientation = 'portrait'): string {
  const size = paperSize(paper);
  const turn = orientation === 'landscape' ? ' landscape' : ' portrait';
  return `@page { size: ${size.cssName}${turn}; margin: ${PRINT_MARGIN_MM}mm; }`;
}

/** Print width on paper, minus both margins — used to say honestly what a wide report needs. */
export function printableWidthMm(paper: PrintPaper, orientation: PrintOrientation = 'portrait'): number {
  const size = paperSize(paper);
  const longEdge = Math.max(size.widthMm, size.heightMm);
  const shortEdge = Math.min(size.widthMm, size.heightMm);
  const width = orientation === 'landscape' ? longEdge : shortEdge;
  return Math.round((width - PRINT_MARGIN_MM * 2) * 10) / 10;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The remembered paper, or A4 (the international default this product's Israeli users print on). */
export function readPrintPaper(): PrintPaper {
  try {
    const saved = storage()?.getItem(PRINT_PAPER_STORAGE_KEY);
    return isPrintPaper(saved) ? saved : 'a4';
  } catch {
    return 'a4';
  }
}

/** Remembers the choice for this browser; a storage failure never breaks the screen. */
export function savePrintPaper(paper: PrintPaper): PrintPaper {
  const value = isPrintPaper(paper) ? paper : 'a4';
  try {
    storage()?.setItem(PRINT_PAPER_STORAGE_KEY, value);
  } catch {
    /* a browser with storage turned off still prints on the default paper */
  }
  return value;
}

/**
 * How many columns the widest header row of the report on screen has — measured at print time, so
 * a report with more columns than a portrait sheet holds turns the sheet instead of losing the
 * last ones. A screen with no table counts as 0 (portrait).
 */
export function countPrintedColumns(root: ParentNode | null | undefined): number {
  if (!root || typeof (root as ParentNode).querySelectorAll !== 'function') return 0;
  const rows = Array.from(root.querySelectorAll('table thead tr'));
  return rows.reduce((widest, row) => Math.max(widest, row.querySelectorAll('th, td').length), 0);
}

/** One line a screen can show: which sheet and how wide the printed table area is. */
export function printLayoutSummary(paper: PrintPaper, orientation: PrintOrientation): string {
  const size = paperSize(paper);
  const turned = orientation === 'landscape' ? ' landscape' : ' portrait';
  return `${size.cssName}${turned} · ${printableWidthMm(paper, orientation)} mm wide`;
}
