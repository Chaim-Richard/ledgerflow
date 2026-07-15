const fs = require('fs');

let reports = fs.readFileSync('src/components/reporting/Reports.tsx', 'utf8');

reports = reports.replace(
  'const [activeTab, setActiveTab] = useState<string>(\'pnl\');',
  'const activeTab = useUIStore(state => state.activeReportTab || \'pnl\');\n  const setActiveTab = useUIStore(state => state.setActiveReportTab);'
);

// wait, is useUIStore imported in Reports? Let's check.
