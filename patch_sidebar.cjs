const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');

const migrateButton = `
              <button
                onClick={() => uiStore.setQBOMigrationOpen(true)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all relative group overflow-hidden mt-4",
                  "text-[var(--text)] bg-green-500/10 border border-green-500/20 hover:bg-green-500/20"
                )}
                title={uiStore.isSidebarOpen ? undefined : "Migrate from QuickBooks"}
              >
                <RefreshCw size={16} className="shrink-0 text-green-500" strokeWidth={2.5} />
                {uiStore.isSidebarOpen && (
                  <span className="truncate text-green-600 font-bold">
                    QBO Migration
                  </span>
                )}
              </button>
`;

if (!code.includes('uiStore.setQBOMigrationOpen')) {
  code = code.replace(
    `            </div>\n         </div>\n         {/* Worlds Rail Section */}`,
    `            </div>\n${migrateButton}\n         </div>\n         {/* Worlds Rail Section */}`
  );
  
  if (!code.includes('RefreshCw')) {
    code = code.replace(
      'import {',
      'import { RefreshCw,'
    );
  }
  
  fs.writeFileSync('src/components/layout/Sidebar.tsx', code);
}
