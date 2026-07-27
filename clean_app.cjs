const fs = require('fs');
let file = 'src/App.tsx';
let app = fs.readFileSync(file, 'utf8');

// The functions in App.tsx start with `const handleApplyAITemplate = useCallback` and so on
app = app.replace(/const handleApplyAITemplate = useCallback\([\s\S]*?\}, \[user, currentWorkspaceId\]\);/g, '');
app = app.replace(/const handleSelectTemplate = useCallback\([\s\S]*?\}, \[user, currentWorkspaceId, setTemplateSelectorOpen, setActiveTab\]\);/g, '');
app = app.replace(/const handleSaveCurrentTemplate = useCallback\([\s\S]*?\}, \[user, currentWorkspaceId, currentWorkspace\]\);/g, '');
app = app.replace(/const handleCreateWorkspace = useCallback\([\s\S]*?\}, \[user\]\);/g, '');
app = app.replace(/const handleLogout = \(\) => \{[\s\S]*?toast.success\('Returned to login screen'\);\n  \};/g, '');

fs.writeFileSync(file, app);
