const fs = require('fs');

function replaceFile(path, from, to) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(from, to);
  fs.writeFileSync(path, content, 'utf8');
}

replaceFile('src/components/layout/InstructionGuide.tsx', /sections\.map\(s =>/g, 'sections.map((s: any) =>');
replaceFile('src/components/layout/InstructionGuide.tsx', /filteredSections\.map\(\(section, idx\) =>/g, 'filteredSections.map((section: any, idx: number) =>');
replaceFile('src/components/layout/InstructionGuide.tsx', /]\.map\(s =>/g, '].map((s: any) =>');

console.log('Fixed lint issues 4');
