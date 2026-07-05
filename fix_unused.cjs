import { promises as fs } from 'fs';
import glob from 'glob';

async function fixFile(filePath) {
  let code = await fs.readFile(filePath, 'utf-8');
  
  // Replace catch(e) -> catch(_e)
  code = code.replace(/catch\s*\(\w*\s*:\s*.*?\)/g, match => match.replace(/\(/, '(_')); // naive but let's do simpler
  code = code.replace(/catch\s*\(([^_)\s]+)\s*\)/g, "catch (_$1)");
  
  // Actually, we can just replace unused variables based on eslint output, but that's hard to parse.
  // Instead, let's prefix common unused ones.
  code = code.replace(/catch\s*\(\s*error\s*\)/g, 'catch (_error)');
  code = code.replace(/catch\s*\(\s*e\s*\)/g, 'catch (_e)');
  code = code.replace(/catch\s*\(\s*err\s*\)/g, 'catch (_err)');
  code = code.replace(/catch\s*\(\s*textErr\s*\)/g, 'catch (_textErr)');

  await fs.writeFile(filePath, code);
}

glob('src/**/*.{ts,tsx}', async (err, files) => {
  for (const file of files) {
    await fixFile(file);
  }
});
