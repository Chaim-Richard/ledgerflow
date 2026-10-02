/**
 * No two server routes answer the same method and path (L-130: the backup import in server.ts and
 * "undo workspace deletion" in workspaceRoutes.ts were both POST /api/v1/workspaces/:id/restore,
 * so the second could never run). Reads server.ts, the route files it registers on the app
 * (registerXRoutes, F-01) and the routers it mounts (with the area files a router imports, F-06).
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const METHOD = /\b(\w+)\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\3/g;
const norm = (p: string) => p.replace(/:\w+/g, ':param').replace(/\/+$/, '') || '/';

/** A router file plus the local files it imports (F-06: transactionRouter's areas live in ./transactions/). */
function routerSource(file: string): string {
  const text = fs.readFileSync(file, 'utf8');
  const parts = [text];
  for (const m of text.matchAll(/import\s*\{[^}]*\}\s*from\s*["'](\.\/[\w./-]+?)(?:\.ts)?["']/g)) {
    const local = path.join(path.dirname(file), `${m[1]}.ts`);
    if (fs.existsSync(local)) parts.push(fs.readFileSync(local, 'utf8'));
  }
  return parts.join('\n');
}

function serverRoutes(): Array<{ method: string; path: string; where: string }> {
  const server = fs.readFileSync(path.join(ROOT, 'server.ts'), 'utf8');
  const routes: Array<{ method: string; path: string; where: string }> = [];
  // routers imported by server.ts: name → file
  const routerFiles = new Map<string, string>();
  for (const m of server.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](\.\/src\/server\/routes\/[\w./-]+?)(?:\.ts)?["']/g)) {
    for (const name of m[1].split(',').map(n => n.trim().split(/\s+as\s+/).pop()!).filter(n => /Router$/.test(n))) {
      routerFiles.set(name, path.join(ROOT, `${m[2]}.ts`));
    }
  }
  for (const m of server.matchAll(METHOD)) {
    if (m[1] === 'app') routes.push({ method: m[2], path: norm(m[4]), where: 'server.ts' });
  }
  // route files that add routes to the app directly: registerXRoutes(app, …)
  for (const m of server.matchAll(/import\s*\{\s*(register\w+Routes)\s*\}\s*from\s*["'](\.\/src\/server\/routes\/[\w./-]+?)(?:\.ts)?["']/g)) {
    const file = path.join(ROOT, `${m[2]}.ts`);
    const text = fs.readFileSync(file, 'utf8');
    for (const r of text.matchAll(METHOD)) {
      if (r[1] === 'app') routes.push({ method: r[2], path: norm(r[4]), where: path.relative(ROOT, file) });
    }
  }
  for (const m of server.matchAll(/app\.use\(\s*["'`]([^"'`]+)["'`][^)]*?\b(\w+Router)\s*\)/g)) {
    const file = routerFiles.get(m[2]);
    if (!file || !fs.existsSync(file)) continue;
    const text = routerSource(file);
    for (const r of text.matchAll(METHOD)) {
      if (r[1] !== m[2]) continue;
      routes.push({ method: r[2], path: norm(`${m[1]}${r[4] === '/' ? '' : r[4]}`), where: path.relative(ROOT, file) });
    }
  }
  return routes;
}

describe('Server routes', () => {
  test('no two routes answer the same method and path', () => {
    const routes = serverRoutes();
    assert.ok(routes.length > 100, `found ${routes.length} routes`);
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const r of routes) {
      const key = `${r.method.toUpperCase()} ${r.path}`;
      if (seen.has(key) && seen.get(key) !== r.where) clashes.push(`${key}: ${seen.get(key)} and ${r.where}`);
      else if (seen.has(key)) clashes.push(`${key}: twice in ${r.where}`);
      else seen.set(key, r.where);
    }
    assert.deepEqual(clashes, []);
  });
});
