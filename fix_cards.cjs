const fs = require('fs');
const glob = require('glob'); // wait we might not have glob, we can use child_process or just find

const { execSync } = require('child_process');

const files = execSync('find src/components -type f -name "*.tsx"').toString().split('\n').filter(Boolean);

let updatedFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/bg-white border border-slate-200 rounded-xl shadow-sm/g, 'bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200');
  newContent = newContent.replace(/bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm/g, 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200');
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    updatedFiles++;
  }
}

console.log("Updated", updatedFiles, "files with better card hovers.");
