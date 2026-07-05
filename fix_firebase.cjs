const fs = require('fs');
const glob = require('child_process').execSync('grep -rl "MOCK_" src/components/operations src/components/finance').toString().trim().split('\n');

for (const file of glob) {
  if (!file) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  // Add Firebase imports if not present
  if (!content.includes("from 'firebase/firestore'")) {
    // find a place to put imports
    const importMatch = content.match(/^import .* from '.*';/gm);
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1];
      let depth = (file.match(/\//g) || []).length;
      let relativePath = depth === 3 ? '../../firebase' : '../../../firebase';
      
      const newImports = `\nimport { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';\nimport { db } from '${relativePath}';`;
      content = content.replace(lastImport, lastImport + newImports);
    }
  }
  
  // Find all state initializations using MOCK_
  // e.g., const [vendors] = useState(MOCK_VENDORS);
  // or const [vendors, setVendors] = useState(MOCK_VENDORS);
  const regex = /const\s+\[\s*([a-zA-Z0-9_]+)\s*(?:,\s*set[a-zA-Z0-9_]+)?\s*\]\s*=\s*useState(?:<[^>]+>)?\s*\(\s*MOCK_[a-zA-Z0-9_]+\s*\)\s*;/g;
  
  let match;
  let matches = [];
  while ((match = regex.exec(content)) !== null) {
    matches.push({ full: match[0], varName: match[1] });
  }
  
  for (const m of matches) {
    const varName = m.varName;
    const setterName = 'set' + varName.charAt(0).toUpperCase() + varName.slice(1);
    const mockNameMatch = m.full.match(/MOCK_[A-zA-Z0-9_]+/);
    const mockName = mockNameMatch ? mockNameMatch[0] : '[]';
    
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
  
  // Save back
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}
