import fs from 'node:fs';
import path from 'node:path';

/**
 * The text of every data type: src/types.ts plus the area files it re-exports (src/model/*.ts,
 * F-10). Tests that look for an interface or a field read this.
 */
export function typesSource(root = process.cwd()): string {
  const dir = path.join(root, 'src/model');
  const files = ['src/types.ts', ...fs.readdirSync(dir).filter(f => f.endsWith('.ts')).sort().map(f => `src/model/${f}`)];
  return files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
}
