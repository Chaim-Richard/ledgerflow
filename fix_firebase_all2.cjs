const fs = require('fs');
const files = require('child_process').execSync('find src/components -name "*.tsx" -o -name "*.ts"').toString().trim().split('\n');

let updatedFilesCount = 0;
for (const file of files) {
  if (!file) continue;
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  const regex = /const\s+\[\s*([a-zA-Z0-9_]+)\s*(?:,\s*set[a-zA-Z0-9_]+)?\s*\]\s*=\s*useState(?:<[^>]+>)?\s*\(\s*MOCK_[a-zA-Z0-9_]+\s*\)\s*;/g;
  
  let match;
  let matches = [];
  while ((match = regex.exec(content)) !== null) {
    matches.push({ full: match[0], varName: match[1] });
  }
  
  if (matches.length > 0) {
    // Ensure Firebase is imported
    if (!content.includes("from 'firebase/firestore'")) {
      const importMatch = content.match(/^import .* from '.*';/gm);
      if (importMatch) {
        const lastImport = importMatch[importMatch.length - 1];
        let depth = (file.match(/\//g) || []).length;
        let relativePath = depth === 3 ? '../../firebase' : depth === 4 ? '../../../firebase' : '../firebase';
        
        const newImports = `\nimport { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';\nimport { db } from '${relativePath}';`;
        content = content.replace(lastImport, lastImport + newImports);
      }
    }
    
    for (const m of matches) {
      const varName = m.varName;
      const setterName = 'set' + varName.charAt(0).toUpperCase() + varName.slice(1);
      
      const replacement = `const [${varName}, ${setterName}] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, '${varName}'), (snap) => {
      if (!snap.empty) {
        ${setterName}(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        ${setterName}([]);
      }
    });
    return unsub;
  }, []);`;
      content = content.replace(m.full, replacement);
    }
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
    updatedFilesCount++;
  }
}
console.log(`Total files updated: ${updatedFilesCount}`);
