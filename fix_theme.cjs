const fs = require('fs');
let content = fs.readFileSync('src/stores/useUIStore.ts', 'utf8');

// add setTheme to the interface
content = content.replace(
  '  resetLexiconOverrides: () => void;',
  '  resetLexiconOverrides: () => void;\n  setTheme: (theme: \'light\' | \'dark\' | \'system\') => void;'
);

// add setTheme to the create object
content = content.replace(
  '  setDevMode: (val) => set({ isDevMode: val }),',
  '  setDevMode: (val) => set({ isDevMode: val }),\n  setTheme: (theme) => {\n    try {\n      localStorage.setItem(\'lf_theme\', theme);\n    } catch (e) {}\n    set({ theme });\n  },'
);

fs.writeFileSync('src/stores/useUIStore.ts', content);
console.log("Updated useUIStore.ts");
