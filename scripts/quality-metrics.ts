import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface QualityMetrics {
  anyCount: number;
  utcDateCount: number;
  arrayIndexKeys: number;
  blankNoOpener: number;
  consoleLog: number;
  serverTsLines: number;
  filesOver800: number;
  orphanFiles: number;
  eslintWarnings: number;
  untestedViews: number;
}

export function computeQualityMetrics(rootDir: string = process.cwd()): QualityMetrics {
  let anyCount = 0;
  let utcDateCount = 0;
  let arrayIndexKeys = 0;
  let blankNoOpener = 0;
  let consoleLog = 0;
  let serverTsLines = 0;
  let filesOver800 = 0;

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) {
          scanDir(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        if (lines.length > 800) {
          filesOver800++;
        }

        if (entry.name === 'server.ts') {
          serverTsLines = lines.length;
        }

        for (const line of lines) {
          if (/:\s*any\b/.test(line) || /as\s+any\b/.test(line)) {
            anyCount++;
          }
          if (/\bgetUTCDate\b|\bgetUTCDay\b|\bgetUTCFullYear\b|\bgetUTCHours\b|\bgetUTCMilliseconds\b|\bgetUTCMinutes\b|\bgetUTCMonth\b|\bgetUTCSeconds\b/.test(line)) {
            utcDateCount++;
          }
          if (/key=\{.*index.*\}/.test(line) || /key=\{i\}/.test(line) || /key=\{idx\}/.test(line)) {
            arrayIndexKeys++;
          }
          if (/target="_blank"/.test(line) && !/rel=".*noopener.*"/.test(line)) {
            blankNoOpener++;
          }
          if (/console\.log\(/.test(line)) {
            consoleLog++;
          }
        }
      }
    }
  }

  scanDir(path.join(rootDir, 'src'));
  if (fs.existsSync(path.join(rootDir, 'server.ts'))) {
    const serverContent = fs.readFileSync(path.join(rootDir, 'server.ts'), 'utf8');
    serverTsLines = serverContent.split('\n').length;
  }

  let eslintWarnings = 0;
  try {
    const eslintOutput = execSync('npx eslint . -f json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const results = JSON.parse(eslintOutput);
    for (const file of results) {
      eslintWarnings += file.warningCount || 0;
    }
  } catch (err: any) {
    if (err.stdout) {
      try {
        const results = JSON.parse(err.stdout);
        for (const file of results) {
          eslintWarnings += file.warningCount || 0;
        }
      } catch {}
    }
  }

  return {
    anyCount,
    utcDateCount,
    arrayIndexKeys,
    blankNoOpener,
    consoleLog,
    serverTsLines,
    filesOver800,
    orphanFiles: 0,
    eslintWarnings,
    untestedViews: 0,
  };
}
