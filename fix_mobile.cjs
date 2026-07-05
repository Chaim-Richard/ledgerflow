const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Replace responsive padding
      let newContent = content.replace(/className="([^"]*)(\bp-10\b)([^"]*)"/g, 'className="$1p-4 md:p-10$3"');
      newContent = newContent.replace(/className="([^"]*)(\bp-8\b)([^"]*)"/g, 'className="$1p-4 md:p-8$3"');
      
      // Fix fonts taking up horizontal space unconditionally on mobile
      newContent = newContent.replace(/className="([^"]*)(\btext-[456]xl\b)([^"]*)"/g, (match, prefix, size, suffix) => {
        if (size === 'text-6xl') return `className="${prefix}text-4xl md:text-6xl${suffix}"`;
        if (size === 'text-5xl') return `className="${prefix}text-3xl md:text-5xl${suffix}"`;
        if (size === 'text-4xl') return `className="${prefix}text-2xl md:text-4xl${suffix}"`;
        return match;
      });

      if (newContent !== content) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir(path.join(process.cwd(), 'src/components'));
