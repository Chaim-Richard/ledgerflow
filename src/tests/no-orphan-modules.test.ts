import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      if (!file.endsWith('.test.ts') && !file.endsWith('.test.tsx') && !file.endsWith('.d.ts')) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

describe('Automated Structural Guard: Zero Orphan Modules in src/lib', () => {
  test('every utility module in src/lib is imported by at least one non-test application file', () => {
    const libFiles = getAllFiles(path.resolve('src/lib'));
    const allAppFiles = getAllFiles(path.resolve('src')).filter(f => !f.includes('/tests/'));

    // Read content of all non-test files
    const appContents = allAppFiles.map(f => fs.readFileSync(f, 'utf-8'));

    const orphans: string[] = [];

    for (const file of libFiles) {
      const fileName = path.basename(file, path.extname(file));
      // Ignore index barrel files
      if (fileName === 'index') continue;

      let isReferenced = false;
      for (const content of appContents) {
        // If the file itself contains its own name or another file imports it
        // We check if another file (not itself) imports or references its name
        const occurrences = (content.match(new RegExp(fileName, 'g')) || []).length;
        if (occurrences > 0) {
          // Check if this content is from a DIFFERENT file or if there's an import statement
          if (content.includes(`/${fileName}`) || content.includes(`'${fileName}'`) || content.includes(`"${fileName}"`) || content.includes(fileName)) {
            // Ensure it's not just the file referencing itself
            const thisFileName = path.basename(file);
            if (!content.includes(`export class ${fileName}`) || occurrences > 1) {
              isReferenced = true;
              break;
            }
          }
        }
      }

      if (!isReferenced) {
        orphans.push(fileName);
      }
    }

    assert.deepEqual(
      orphans,
      [],
      `Orphan modules detected in src/lib! The following files are not imported by any non-test file: ${orphans.join(', ')}`
    );
  });
});
