const fs = require('fs');

let settings = fs.readFileSync('src/components/platform/settings/ShortcutSettings.tsx', 'utf8');

settings = settings.replace(
  "import { APP_TABS } from '../../../config/registry';",
  "import { APP_TABS, SETTINGS_TABS_REGISTRY, REPORT_TABS_REGISTRY, INTELLIGENCE_TABS_REGISTRY, ANALYTICAL_LENSES_REGISTRY } from '../../../config/registry';"
);

// We want to combine all registries into an ALL_TOOLS array inside the component.
settings = settings.replace(
  'const handleAdd = () => {',
  `
  const ALL_TOOLS = [
    ...APP_TABS,
    ...SETTINGS_TABS_REGISTRY,
    ...REPORT_TABS_REGISTRY,
    ...INTELLIGENCE_TABS_REGISTRY,
    ...ANALYTICAL_LENSES_REGISTRY
  ];
  
  const handleAdd = () => {`
);

settings = settings.replace(
  '{APP_TABS.map(tab => (',
  '{ALL_TOOLS.map(tab => ('
);

settings = settings.replace(
  'const tab = APP_TABS.find(t => t.id === tabId);',
  'const tab = ALL_TOOLS.find(t => t.id === tabId);'
);

fs.writeFileSync('src/components/platform/settings/ShortcutSettings.tsx', settings);
