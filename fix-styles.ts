import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir: string, callback: (path: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

const dir = path.join(process.cwd(), 'src');
walkDir(dir, (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content.replace(/rounded-\[([0-9.]+)rem\]/g, 'rounded-2xl');
    newContent = newContent.replace(/font-black uppercase tracking-widest/g, 'font-medium uppercase tracking-wider');
    newContent = newContent.replace(/bg-slate-900/g, 'bg-google-blue');
    newContent = newContent.replace(/text-slate-900/g, 'text-slate-800');
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent);
      console.log('Fixed:', filePath);
    }
  }
});
