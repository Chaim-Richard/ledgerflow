import React, { useState, useMemo } from 'react';
import { Layers, FolderTree, Tag, Search, Filter, ChevronRight, ChevronDown, Plus, Activity } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';

interface TreeNode {
  id: string;
  name: string;
  path: string;
  revenue: number;
  expense: number;
  net: number;
  children: Record<string, TreeNode>;
  isExpanded?: boolean;
}

export default function UniversalOperations() {
  const { transactions, accounts } = useLedgerStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const toggleNode = (path: string) => {
    setExpandedNodes(prev => ({ ...prev, [path]: !prev[path] }));
  };

  // Build a multi-dimensional hierarchical tree based on transaction tags
  const hierarchy = useMemo(() => {
    const root: Record<string, TreeNode> = {};

    const addAmountToPath = (pathArray: string[], revenue: number, expense: number) => {
      let currentLevel = root;
      let currentPath = '';

      pathArray.forEach((part, index) => {
        const cleanPart = part.trim();
        if (!cleanPart) return;

        currentPath = currentPath ? `${currentPath} / ${cleanPart}` : cleanPart;

        if (!currentLevel[cleanPart]) {
          currentLevel[cleanPart] = {
            id: cleanPart,
            name: cleanPart,
            path: currentPath,
            revenue: 0,
            expense: 0,
            net: 0,
            children: {}
          };
        }

        currentLevel[cleanPart].revenue += revenue;
        currentLevel[cleanPart].expense += expense;
        currentLevel[cleanPart].net += (revenue - expense);

        currentLevel = currentLevel[cleanPart].children;
      });
    };

    transactions.forEach(tx => {
      tx.lines.forEach(line => {
        // Determine if account is revenue or expense (simplified based on typical 4xxx/5xxx structure)
        const account = accounts.find(a => a.id === line.accountId);
        let rev = 0;
        let exp = 0;
        
        if (account) {
          if (account.category === 'revenue') {
            rev = line.amountCents; // Credit to revenue is positive
          } else if (account.category === 'expense') {
            exp = line.amountCents; // Debit to expense is positive
          }
        }

        if (line.tags && line.tags.length > 0) {
          line.tags.forEach(tag => {
            // Support hierarchical tags using '/' or '>' separator
            const pathArray = tag.split(/[/>]/).map(s => s.trim()).filter(Boolean);
            if (pathArray.length > 0) {
              addAmountToPath(pathArray, rev, exp);
            }
          });
        }
      });
    });

    return root;
  }, [transactions, accounts]);

  const renderTree = (nodes: Record<string, TreeNode>, level: number = 0) => {
    return Object.values(nodes).map(node => {
      const hasChildren = Object.keys(node.children).length > 0;
      const isExpanded = expandedNodes[node.path];

      // Filter logic: if search term exists, only show matching paths
      if (searchTerm && !node.path.toLowerCase().includes(searchTerm.toLowerCase()) && !hasChildren) {
        return null; // Very basic filter, in a real app we'd do a deep filter
      }

      return (
        <div key={node.path} className="flex flex-col">
          <div 
            className={`flex items-center justify-between py-3 px-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${level === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
            style={{ paddingLeft: `${(level * 24) + 16}px` }}
          >
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => hasChildren && toggleNode(node.path)}>
              {hasChildren ? (
                isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />
              ) : (
                <div className="w-[14px]"></div> // Spacer
              )}
              <Tag size={14} className={level === 0 ? "text-indigo-500" : "text-slate-400"} />
              <span className={`text-sm ${level === 0 ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}`}>
                {node.name}
              </span>
            </div>
            
            <div className="flex items-center gap-8 text-right">
              <div className="w-24">
                <span className="text-xs font-mono font-bold text-emerald-600">
                  {node.revenue > 0 ? `$${node.revenue.toLocaleString()}` : '-'}
                </span>
              </div>
              <div className="w-24">
                <span className="text-xs font-mono font-bold text-rose-600">
                  {node.expense > 0 ? `$${node.expense.toLocaleString()}` : '-'}
                </span>
              </div>
              <div className="w-24">
                <span className={`text-xs font-mono font-black ${node.net >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                  ${node.net.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          
          {hasChildren && isExpanded && (
            <div className="flex flex-col w-full">
              {renderTree(node.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const rootNodesCount = Object.keys(hierarchy).length;

  return (
    <div className="h-full flex flex-col p-6 bg-[#fbfbfc] space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
              <Layers className="text-indigo-500" size={18} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-wider">Universal Omni-Tracker</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Infinite hierarchical tagging for any business model. Define dimensions like <b>"Building 1 / Unit 4"</b> or <b>"Campaign A / Q3"</b> in transaction tags to automatically generate structured P&L roll-ups.
          </p>
        </div>
        <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md shadow-slate-900/20 flex items-center gap-2 hover:bg-slate-800 transition-colors">
          <Plus size={14} /> New Tracking Rule
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 p-5 rounded-[32px] shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Root Dimensions</h3>
            <FolderTree className="text-indigo-500" size={16} />
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2">{rootNodesCount}</p>
          <p className="text-[10px] text-indigo-500 font-bold uppercase mt-1">Active tracking categories</p>
        </div>
        
        <div className="md:col-span-2 bg-slate-900 rounded-[32px] p-5 text-white relative overflow-hidden shadow-lg shadow-indigo-900/10">
          <div className="relative z-10">
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-2 flex items-center gap-2">
              <Activity size={14} /> How it works
            </h3>
            <p className="text-sm font-medium text-slate-300 mb-3">
              Tag your transaction lines with paths. For example, tagging a line with <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">Property A / Unit 101</code> will automatically allocate expenses to both <b>Unit 101</b> and roll them up to <b>Property A</b>.
            </p>
            <p className="text-xs text-slate-400">
              This completely replaces the need for 1000 different specialized modules. Whether you run Real Estate, E-commerce, or Manufacturing, just define your own taxonomy.
            </p>
          </div>
          <Layers className="absolute -right-8 -bottom-8 text-white/5" size={120} />
        </div>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-[32px] shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-800">Dimensional Roll-up Report</h3>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search dimensions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 text-slate-700 w-48"
              />
            </div>
            <button className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">
              <Filter size={14} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between py-2 px-4 border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-widest sticky top-0 z-10">
            <div>Dimension / Node</div>
            <div className="flex items-center gap-8 text-right">
              <div className="w-24">Allocated Revenue</div>
              <div className="w-24">Allocated Expense</div>
              <div className="w-24">Net Contribution</div>
            </div>
          </div>
          
          <div className="flex flex-col">
            {rootNodesCount > 0 ? (
              renderTree(hierarchy)
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FolderTree size={32} className="text-slate-200 mb-3" />
                <h3 className="text-sm font-bold text-slate-700">No Dimensional Tags Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Add tags to your transaction lines using a "/" separator to start tracking custom dimensions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
