/**
 * S-05: read-only inventory of HTTP write route declarations.
 *
 * Does NOT certify that a route is idempotent. The original #254 audit
 * hard-coded "guarded" status for endpoints that were not independently
 * traced to the source. A handler referencing a helper is only a lead.
 *
 * Usage: npx tsx scripts/idempotency-route-inventory.ts
 */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

export interface WriteRouteFinding {
  file: string;
  line: number;
  method: string;
  route: string;
  evidence: 'visible-helper-call' | 'not-visible';
  note: string;
}

const WRITE_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const HELPERS = new Set(['executeIdempotent', 'executeCommand']);

function hasHelperCall(node: ts.Node): boolean {
  let found = false;
  const scan = (part: ts.Node) => {
    if (ts.isCallExpression(part)) {
      const expression = part.expression;
      const name = ts.isIdentifier(expression) ? expression.text :
        ts.isPropertyAccessExpression(expression) ? expression.name.text : '';
      if (HELPERS.has(name)) found = true;
    }
    ts.forEachChild(part, scan);
  };
  scan(node);
  return found;
}

export function inspectRouteSource(source: string, file: string): WriteRouteFinding[] {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const findings: WriteRouteFinding[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text.toLowerCase();
      if (WRITE_METHODS.has(method) && node.arguments.length >= 1) {
        const routeArg = node.arguments[0];
        // For dynamic route registrations, use the source expression itself and
        // leave its resolution unverified.
        const route = ts.isStringLiteralLike(routeArg) ? routeArg.text : routeArg.getText(parsed);
        const start = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
        const hasDirectCall = node.arguments.slice(1).some(arg => hasHelperCall(arg));
        findings.push({
          file, line: start.line + 1, method: method.toUpperCase(), route,
          evidence: hasDirectCall ? 'visible-helper-call' : 'not-visible',
          note: hasDirectCall
            ? 'A helper call appears in the inline handler; review operation identity, durability, and retries.'
            : 'No direct helper call is visible here; trace middleware, delegated handlers, and posting services before classifying.',
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return findings;
}

function findSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? findSourceFiles(file) :
      /\.(ts|tsx)$/.test(entry.name) ? [file] : [];
  });
}

export function getWriteRouteInventory(root = process.cwd()): WriteRouteFinding[] {
  const dir = path.join(root, 'src/server/routes');
  return findSourceFiles(dir).flatMap(file => {
    const content = fs.readFileSync(file, 'utf8');
    return inspectRouteSource(content, path.relative(root, file).replaceAll('\\', '/'));
  }).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

export function inventoryMarkdown(routes: WriteRouteFinding[]): string {
  const lines = [
    '# Financial write route inspection leads',
    '',
    'This is an AST-discovered inventory of HTTP method declarations, **not** proof that any route is retry-safe.',
    'Routes registered dynamically or outside src/server/routes may be missing.',
    'A visible helper call does not prove stable idempotency keys or atomic writes.',
    '',
    '| Source | Method | Route | Static evidence |',
    '|---|---|---|---|',
    ...routes.map(r => `| ${r.file}:${r.line} | ${r.method} | ${r.route.replaceAll('|', '\\|')} | ${r.evidence} |`),
    '',
    'Next: for each money-posting route, inspect the delegated service and replay the SAME operation ID after commit, timeout and concurrency against PostgreSQL.',
    '',
  ];
  return lines.join('\n');
}

if (process.argv[1]?.endsWith('idempotency-route-inventory.ts')) {
  const routes = getWriteRouteInventory();
  process.stdout.write(inventoryMarkdown(routes));
}
