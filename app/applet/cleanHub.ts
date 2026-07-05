import * as fs from 'fs';

const path = 'src/components/platform/ApiHub.tsx';
let content = fs.readFileSync(path, 'utf8');

const startIndex = content.indexOf("{activeTab === 'billing' && (");
if (startIndex !== -1) {
  const endIndexStr = "      )}\n\n    </div>\n  );\n}";
  const endIndex = content.indexOf(endIndexStr, startIndex);
  
  if (endIndex !== -1) {
    const newContent = content.substring(0, startIndex) + content.substring(endIndex + 9); 
    fs.writeFileSync(path, newContent, 'utf8');
    console.log("Successfully removed billing tab block.");
  } else {
    console.log("Could not find end of billing tab block.", content.substring(startIndex, startIndex + 100));
  }
} else {
  console.log("Could not find start of billing tab block.");
}
