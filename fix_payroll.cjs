const fs = require('fs');
let file = fs.readFileSync('src/components/finance/PayrollHub.tsx', 'utf8');
const badBlock = "  // Auto-seed handler to populate default employees in database securely\n        </div>\n      </div>";
const goodBlock = `  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Users className="w-6 h-6 text-indigo-400" />
            Payroll & Workforce Hub
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage global workforce profiles, automated tax tables, and period pay runs.</p>
        </div>
      </div>`;
file = file.replace(badBlock, goodBlock);
file = file.replace("            <button \n             <button", "            <button");
fs.writeFileSync('src/components/finance/PayrollHub.tsx', file);
