const fs = require('fs');
let code = fs.readFileSync('src/hooks/useFinancialReporting.ts', 'utf8');

const targetFunctionStart = `const fetchPL = useCallback(async (startDate?: string, endDate?: string) => {`;

const newFunction = `const fetchPL = useCallback(async (startDate?: string, endDate?: string) => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;
      
      let url = \`/api/v1/reports/pl?workspaceId=\${currentWorkspaceId}\`;
      if (startDate) url += \`&startDate=\${startDate}\`;
      if (endDate) url += \`&endDate=\${endDate}\`;

      const token = await user.getIdToken();
      const response = await fetch(url, {
         headers: { 'Authorization': \`Bearer \${token}\` }
      });
      const data = await response.json();
      if (data.status === 'success') {
         setApiReports(prev => ({ ...prev, pl: data.data }));
      }
    } catch (e: any) {
      toast.error('Failed to fetch P&L');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId]);`;

// Need to safely replace the old fetchPL. Let's find the closing brace of fetchPL.
// It's easier to just match from `const fetchPL` to `}, [currentWorkspaceId, transactions, accounts]);`
const oldFetchPLRegex = /const fetchPL = useCallback\(async[\s\S]*?\}, \[currentWorkspaceId[^\]]*\]\);/;
code = code.replace(oldFetchPLRegex, newFunction);

fs.writeFileSync('src/hooks/useFinancialReporting.ts', code);
