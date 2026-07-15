const fs = require('fs');
let code = fs.readFileSync('src/components/system/ProcessAutomationHub.tsx', 'utf8');
code = code.replace(
  /const \[workflows, setWorkflows\] = useState\(autoRules\?\.length \? autoRules : \[[\s\S]*?\]\);/,
  "const [workflows, setWorkflows] = useState<any[]>(autoRules?.length ? autoRules : []);"
);
fs.writeFileSync('src/components/system/ProcessAutomationHub.tsx', code);
