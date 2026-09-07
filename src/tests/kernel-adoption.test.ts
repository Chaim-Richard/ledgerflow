import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

function walkDir(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);
  for (const file of files) {
    const stat = statSync(join(dir, file));
    if (stat.isDirectory()) {
      fileList = walkDir(join(dir, file), fileList);
    } else if (file.endsWith('.ts')) {
      fileList.push(join(dir, file));
    }
  }
  return fileList;
}

test('Kernel modules must be adopted outside of src/kernel/ and src/tests/', () => {
  const kernelFiles = walkDir('src/kernel');
  
  for (const file of kernelFiles) {
    const base = basename(file, '.ts');
    
    let output = '';
    try {
      // Just search for the base name in import/require statements
      const regex = `from ['"][^'"]*${base}(\\.js)?['"]`;
      output = execFileSync('grep', ['-rn', '-E', regex, 'src/'], { encoding: 'utf8' });
    } catch (e: any) {
      if (e.stderr && e.stderr.length > 0) {
        console.error('grep error:', e.stderr.toString());
      }
      if (e.stdout) {
         output = e.stdout.toString();
      }
    }
    
    const lines = output.split('\n').filter(l => l.trim() !== '');
    const validAdopters = lines.filter(line => !line.startsWith('src/kernel/') && !line.startsWith('src/tests/'));
    
    assert.ok(validAdopters.length > 0, `Orphaned kernel module detected: ${file}. It has no importers outside src/kernel/ and src/tests/.`);
  }
});
