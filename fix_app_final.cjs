const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(/<RootLayout[\s\S]*?\/>/, '<RootLayout />');
fs.writeFileSync('src/App.tsx', app);

let root = fs.readFileSync('src/core/layout/RootLayout.tsx', 'utf8');
root = root.replace(/export function RootLayout\(\{[\s\S]*?\}\: any\) \{/, `import { useCommandDispatcher } from '../../hooks/useSystemContext';\nimport { useTransactionActions } from '../../hooks/useTransactionActions';\nimport { useAIActions } from '../../hooks/useAIActions';\n\nexport function RootLayout() {\n  const { handleAction } = useCommandDispatcher();\n  const txActions = useTransactionActions();\n  const ai = useAIActions();\n  const handleLogout = () => useAuthStore.getState().logout();\n  const handleLoginPrompt = () => handleAction('open-login');\n  const handleSelectTemplate = () => {};\n  const handleSaveCurrentTemplate = () => {};\n  const handleApplyAITemplate = () => {};\n  const handleCreateWorkspace = () => {};\n  const isPending = false;`);

// ensure no duplicate imports
if (root.match(/import \{ useCommandDispatcher \} from '\.\.\/\.\.\/hooks\/useSystemContext'/g)?.length > 1) {
  root = root.replace(/import \{ useCommandDispatcher \} from '\.\.\/\.\.\/hooks\/useSystemContext';\n/, '');
}
if (root.match(/import \{ useTransactionActions \} from '\.\.\/\.\.\/hooks\/useTransactionActions'/g)?.length > 1) {
  root = root.replace(/import \{ useTransactionActions \} from '\.\.\/\.\.\/hooks\/useTransactionActions';\n/, '');
}
if (root.match(/import \{ useAIActions \} from '\.\.\/\.\.\/hooks\/useAIActions'/g)?.length > 1) {
  root = root.replace(/import \{ useAIActions \} from '\.\.\/\.\.\/hooks\/useAIActions';\n/, '');
}

fs.writeFileSync('src/core/layout/RootLayout.tsx', root);
