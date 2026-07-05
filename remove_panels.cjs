const fs = require('fs');
const content = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');
const lines = content.split('\n');

// Find the start line: {/* Dynamic Interactive Role Workspace Subpanels */}
let startIndex = lines.findIndex(l => l.includes('{/* Dynamic Interactive Role Workspace Subpanels */}'));

// Find the end line: <div className="grid gap-10"> right after the dynamic panels
let endIndex = lines.findIndex((l, i) => i > startIndex && l.includes('<div className="grid gap-10">'));

if (startIndex !== -1 && endIndex !== -1) {
  lines.splice(startIndex, endIndex - startIndex);
  fs.writeFileSync('src/components/Dashboard.tsx', lines.join('\n'));
  console.log('Successfully removed the dynamic subpanels block');
} else {
  console.log('Could not find start or end index', startIndex, endIndex);
}
