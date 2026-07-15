const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

// Insert after setActiveTabStore
app = app.replace(
  'const setActiveTabStore = useUIStore(state => state.setActiveTab);',
  'const setActiveTabStore = useUIStore(state => state.setActiveTab);\n  const navigateToolStore = useUIStore(state => state.navigateTool);'
);

app = app.replace(
  'const setActiveTab = useCallback((tab: any) => {',
  `const navigateTool = useCallback((tab: any) => {
    startTransition(() => {
        navigateToolStore(tab);
    });
  }, [navigateToolStore]);\n\n  const setActiveTab = useCallback((tab: any) => {`
);

app = app.replace(
  'isShortcutOverlayOpen, isArchitectureOpen, speedDials',
  'isShortcutOverlayOpen, isArchitectureOpen, speedDials, navigateTool'
);

fs.writeFileSync('src/App.tsx', app);
