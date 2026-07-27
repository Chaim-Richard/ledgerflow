const fs = require('fs');
let file = 'src/core/layout/RootLayout.tsx';
let root = fs.readFileSync(file, 'utf8');

root = root.replace(
  /export function RootLayout\(\) \{/,
  "import { useSystemActions } from '../../hooks/useSystemActions';\n\nexport function RootLayout() {"
);

root = root.replace(
  /  const handleLogout = \(\) => useAuthStore.getState\(\).logout\(\);\n  const handleLoginPrompt = \(\) => handleAction\('open-login'\);\n  const handleSelectTemplate = \(\) => \{\};\n  const handleSaveCurrentTemplate = \(\) => \{\};\n  const handleApplyAITemplate = \(\) => \{\};\n  const handleCreateWorkspace = \(\) => \{\};/,
  "  const { handleLogout, handleApplyAITemplate, handleSelectTemplate, handleSaveCurrentTemplate, handleCreateWorkspace } = useSystemActions();\n  const handleLoginPrompt = () => handleAction('open-login');"
);

fs.writeFileSync(file, root);
