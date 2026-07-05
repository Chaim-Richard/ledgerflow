const fs = require('fs');

const files = [
  'src/components/Dashboard.tsx',
  'src/components/layout/Header.tsx',
  'src/components/layout/Sidebar.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/className="((?:[^"]*text-[x234]xl[^"]*)|(?:[^"]*font-semibold[^"]*)|(?:[^"]*font-bold[^"]*))"/g, (match, p1) => {
    if (!p1.includes('font-display') && (p1.includes('text-xl') || p1.includes('text-2xl') || p1.includes('text-3xl') || p1.includes('text-4xl') || p1.includes('text-lg'))) {
      return `className="${p1} font-display"`;
    }
    return match;
  });
  fs.writeFileSync(file, content);
});

console.log("Added font-display to headings");
