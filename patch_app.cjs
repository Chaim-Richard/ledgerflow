const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(
  'const setActiveTab = useUIStore(state => state.setActiveTab);',
  'const setActiveTab = useUIStore(state => state.setActiveTab);\n  const navigateTool = useUIStore(state => state.navigateTool);'
);

app = app.replace(
  'base[`alt+${key.toLowerCase()}`] = () => setActiveTab(tabId as any);',
  'base[`alt+${key.toLowerCase()}`] = () => navigateTool(tabId);'
);

fs.writeFileSync('src/App.tsx', app);
