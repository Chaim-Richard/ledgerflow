const fs = require('fs');

let settings = fs.readFileSync('src/components/platform/Settings.tsx', 'utf8');

settings = settings.replace(
  'const [activeSubTab, setActiveSubTab] = useState<string>(\'billing\');',
  `const activeSubTab = useUIStore(state => state.activeSettingsTab || 'billing');
  const setActiveSubTab = useUIStore(state => state.setActiveSettingsTab);`
);

fs.writeFileSync('src/components/platform/Settings.tsx', settings);
