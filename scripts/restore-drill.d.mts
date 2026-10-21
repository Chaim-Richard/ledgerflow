/** Node ESM helper signatures for the standalone restore-drill.mjs utility. */
export function validateDisposableDbUrl(value: string | undefined): { url: URL; database: string };
export function performLocalRestoreDrill(value: string | undefined): { passed: true; source: string; tableCount: number; note: string };
