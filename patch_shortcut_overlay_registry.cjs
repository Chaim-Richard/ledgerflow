const fs = require('fs');

let overlay = fs.readFileSync('src/components/layout/ShortcutOverlay.tsx', 'utf8');

overlay = overlay.replace(
  "import { APP_TABS } from '../../config/registry';",
  "import { APP_TABS, SETTINGS_TABS_REGISTRY, REPORT_TABS_REGISTRY, INTELLIGENCE_TABS_REGISTRY, ANALYTICAL_LENSES_REGISTRY } from '../../config/registry';"
);

overlay = overlay.replace(
  'const hasSpeedDials = speedDials && Object.keys(speedDials).length > 0;',
  `const hasSpeedDials = speedDials && Object.keys(speedDials).length > 0;
  
  const ALL_TOOLS = [
    ...APP_TABS,
    ...SETTINGS_TABS_REGISTRY,
    ...REPORT_TABS_REGISTRY,
    ...INTELLIGENCE_TABS_REGISTRY,
    ...ANALYTICAL_LENSES_REGISTRY
  ];`
);

overlay = overlay.replace(
  'const tab = APP_TABS.find(t => t.id === tabId);',
  'const tab = ALL_TOOLS.find(t => t.id === tabId);'
);

fs.writeFileSync('src/components/layout/ShortcutOverlay.tsx', overlay);
