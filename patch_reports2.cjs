const fs = require('fs');

let reports = fs.readFileSync('src/components/reporting/Reports.tsx', 'utf8');

if (!reports.includes('const activeTab = useUIStore(state => state.activeReportTab')) {
  reports = reports.replace(
    'const [activeTab, setActiveTab] = useState<string>(\'pnl\');',
    `const activeTab = useUIStore(state => state.activeReportTab || 'pnl');
    const setActiveTab = useUIStore(state => state.setActiveReportTab);`
  );
  fs.writeFileSync('src/components/reporting/Reports.tsx', reports);
}
