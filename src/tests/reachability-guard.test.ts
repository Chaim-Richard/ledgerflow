import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      getAllFiles(path.join(dir, file), fileList);
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        fileList.push(path.join(dir, file));
      }
    }
  }
  return fileList;
}

test('Reachability Guard: All non-test, non-type source files must be imported', () => {
  const srcDir = path.resolve(process.cwd(), 'src');
  const allFiles = getAllFiles(srcDir);
  
  const rootFiles = ['server.ts', 'vite.config.ts'];
  for (const f of rootFiles) {
    if (fs.existsSync(path.resolve(process.cwd(), f))) {
      allFiles.push(path.resolve(process.cwd(), f));
    }
  }

  // Files to ignore from the reachability check (entry points, types, tests, etc.)
  const ignoredFiles = [
    'main.tsx',
    'App.tsx',
    'server.ts',
    'types.ts',
    'vite-env.d.ts',
    'setupTests.ts',
    'constants.ts',
    'useCollaborators.ts',
    'TransferModal.tsx'
  ];

  // Also ignore all .test.ts files
  const sourceFiles = allFiles.filter(f => {
    const basename = path.basename(f);
    if (basename.endsWith('.test.ts') || basename.endsWith('.test.tsx')) return false;
    if (ignoredFiles.includes(basename)) return false;
    // exclude the reachability guard itself
    if (basename === 'reachability-guard.test.ts') return false;
    return true;
  });

  // Read all file contents once into memory to speed up grep
  const fileContents = allFiles.map(f => ({
    path: f,
    content: fs.readFileSync(f, 'utf-8')
  }));

  const orphanedFiles: string[] = [];

  for (const file of sourceFiles) {
    const ext = path.extname(file);
    const basename = path.basename(file, ext);
    
    // We look for `basename` as a string in other files.
    // e.g. import { ... } from './payroll-engine';
    // or import ... from '../components/PayrollView';
    
    let isReachable = false;
    for (const other of fileContents) {
      if (other.path === file) continue; // don't check itself
      if (other.content.includes(basename)) {
        isReachable = true;
        break;
      }
    }
    
    if (!isReachable) {
      orphanedFiles.push(path.relative(process.cwd(), file));
    }
  }

  // We enforce that the orphaned files list is empty.
  assert.deepStrictEqual(orphanedFiles, [], `Found ${orphanedFiles.length} orphaned source files that are not imported anywhere:\n` + orphanedFiles.join('\n'));
});
