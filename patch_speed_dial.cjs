const fs = require('fs');

// Patch App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(
  'base[`shift+${key.toLowerCase()}`] = () => setActiveTab(tabId as any);',
  'base[`alt+${key.toLowerCase()}`] = () => setActiveTab(tabId as any);'
);
fs.writeFileSync('src/App.tsx', app);

// Patch ShortcutSettings.tsx
let settings = fs.readFileSync('src/components/platform/settings/ShortcutSettings.tsx', 'utf8');
settings = settings.replace(
  /Shift \+ \[Key\]/g,
  'Alt + [Key]'
);
settings = settings.replace(
  /Shift \+ /g,
  'Alt + '
);
settings = settings.replace(
  /⇧/g,
  '⌥'
);
fs.writeFileSync('src/components/platform/settings/ShortcutSettings.tsx', settings);
