import fs from 'node:fs';
import path from 'node:path';

/**
 * The text of server.ts plus what it was split into (F-01): the shared helpers
 * (src/server/http/serverKit.ts) and every route file it registers on the app
 * (registerXRoutes). Guard tests that look for a route or a check in "the server" read this.
 */
export function serverSource(root = process.cwd()): string {
  const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
  const files = ['src/server/http/serverKit.ts'];
  for (const m of server.matchAll(/import\s*\{\s*register\w+Routes\s*\}\s*from\s*["']\.\/(src\/server\/routes\/[\w./-]+?)(?:\.ts)?["']/g)) {
    files.push(`${m[1]}.ts`);
  }
  return [server, ...files.map(f => fs.readFileSync(path.join(root, f), 'utf8'))].join('\n');
}
