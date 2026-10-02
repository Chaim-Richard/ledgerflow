import React, { useState } from "react";
import { 
  BookOpen, 
  Search, 
  Layers, 
  RotateCcw, 
  DollarSign, 
  Building, 
  ShieldCheck, 
  TrendingUp, 
  Command, 
  ArrowRight,
  Sparkles,
  ChevronRight,
  LayoutGrid
} from "lucide-react";
import { motion } from "motion/react";
import { useUIStore } from "../../stores/useUIStore";

interface SectionDoc {
  id: string;
  title: string;
  icon: any;
  category: string;
  summary: string;
  steps: string[];
  tips?: string[];
}

const GUIDE_SECTIONS: SectionDoc[] = [
  {
    id: "getting-started",
    title: "Getting Started & System Overview",
    icon: Sparkles,
    category: "Core Concepts",
    summary: "LedgerFlow is a continuous double-entry ERP and financial ledger that enforces immutable mathematical balance and strict accounting integrity.",
    steps: [
      "Navigate modules using the sidebar or press ⌘K (Ctrl+K) to open the Command Palette.",
      "Configure Chart of Accounts in the Account Register or Ledger views.",
      "Connect live bank accounts via Plaid in Bank Connections or import statement files (CSV/OFX/QBO)."
    ],
    tips: [
      "All transactions strictly enforce double-entry equilibrium: debits must equal credits.",
      "Amounts are always absolute, with direction determined by line item debits/credits."
    ]
  },
  {
    id: "sales-invoicing",
    title: "Sales & Customer Invoices",
    icon: DollarSign,
    category: "Money In",
    summary: "Create, send, track, and reconcile sales invoices with tax calculations and payment terms.",
    steps: [
      "Go to Sales and click \"New Invoice\".",
      "Select or type a customer name and set the invoice date and due date.",
      "Add line items with descriptions, quantities, unit prices, and revenue accounts.",
      "Toggle Tax Inclusive if prices already include sales tax, or enter a tax rate percentage.",
      "Click \"Preview PDF\" to generate and download an official formatted PDF document."
    ],
    tips: [
      "Draft invoices do not affect the general ledger until posted.",
      "Overdue invoices can be written off as Bad Debt Expense directly from the action menu."
    ]
  },
  {
    id: "purchases-bills",
    title: "Purchases & Vendor Bills",
    icon: Building,
    category: "Money Out",
    summary: "Record vendor bills, allocate expenses across cost centers, and manage accounts payable.",
    steps: [
      "Go to Purchases and click \"Record New Bill\".",
      "Select a vendor to auto-fill default expense categories.",
      "Add split line items for multi-category expense allocation.",
      "Attach receipts or drag-and-drop document files.",
      "Submit the bill to update Accounts Payable."
    ]
  },
  {
    id: "payments-allocation",
    title: "Payment Receipts & Bill Settlements",
    icon: RotateCcw,
    category: "Money In / Out",
    summary: "Process single or multi-invoice settlement payments with automated oldest-first allocation.",
    steps: [
      "From Sales or Purchases, click \"Receive Payment\" or \"Pay Vendor Bill\".",
      "Select the customer or vendor to automatically populate open documents.",
      "Enter the total settlement amount.",
      "Use \"Apply to oldest first\" or type an amount for each document.",
      "Confirm the deposit/payment cash account and submit."
    ]
  },
  {
    id: "banking-reconciliation",
    title: "Bank Feeds & Zero-Variance Reconciliation",
    icon: Layers,
    category: "Reconcile",
    summary: "Match imported bank lines against general ledger entries to ensure statement reconciliation.",
    steps: [
      "Open Bank Connections to sync transactions or upload statement CSVs.",
      "Review suggestions in the \"To Review\" inbox.",
      "Navigate to Reconciliation and enter your statement closing balance and date.",
      "Check off matching items until Difference reaches exactly $0.00.",
      "Finalize the reconciliation statement to seal the period."
    ]
  },
  {
    id: "period-close-reversals",
    title: "Month-End Close & \"Reverse & Correct\"",
    icon: ShieldCheck,
    category: "Integrity & Security",
    summary: "Lock fiscal periods to prevent retroactive tampering while preserving an auditable correction workflow.",
    steps: [
      "Open Month-End Close and complete the period checklist.",
      "Set the Lock Date to prevent direct edits to transactions on or prior to that date.",
      "If a locked entry requires adjustment, use the \"Reverse & Correct\" action.",
      "Specify the open-period Reversal Date and correction audit reason.",
      "Submit the balanced reversal and replacement entry in the current period."
    ]
  },
  {
    id: "reports-lenses",
    title: "Financial Statements & Intelligence Lenses",
    icon: TrendingUp,
    category: "Reports",
    summary: "Generate deterministic Balance Sheet, P&L, Cash Flow, Tax Liability, and Aging reports.",
    steps: [
      "Navigate to Reports to view real-time Profit & Loss and Balance Sheets.",
      "Filter by period, dimension, project, or cash vs. accrual basis.",
      "Inspect A/R and A/P Aging reports to monitor liquidity and past-due balances."
    ]
  },
  {
    id: "keyboard-shortcuts",
    title: "Keyboard Shortcuts & Power Navigation",
    icon: Command,
    category: "Productivity",
    summary: "Speed up your daily accounting workflows with keyboard shortcuts.",
    steps: [
      "⌘K or Ctrl+K — Open Coordinate Search & Command Palette",
      "? or Shift+/ — Open this Help & Operational Guide",
      "Esc — Close active modal, drilldown, or dialog",
      "⌘Enter or Ctrl+Enter — Submit and save active form / journal"
    ]
  },
  {
    id: "views-directory",
    title: "All Views & Modules Directory",
    icon: LayoutGrid,
    category: "Reference",
    summary: "Complete reference index of all 37 views and tools available across the platform.",
    steps: [
      "Credit Notes (credit-notes): Issue customer credit memos and record vendor credit notes.",
      "Estimates & Quotes (estimates): Draft quotes, track client acceptance, and convert directly to sales invoices.",
      "Statement View (statement): Generate formal customer billing statements and accounts receivable balance summaries.",
      "General Ledger (general-ledger): Deep, chronologically sorted account-by-account transaction logs with running balances.",
      "Tax Liability (tax-liability): Real-time sales tax and VAT reporting with tax-inclusive / exclusive breakdowns.",
      "Projects (projects): Assign revenue, costs, and billable hours to project dimension codes for job costing.",
      "Budgets (budgets): Establish department and account fiscal budgets and track real-time variance against actuals.",
      "Consolidation (consolidation): Multi-entity financial roll-up with automated intercompany transaction eliminations.",
      "Time Machine (time-machine): Inspect the exact historical state of the entire financial ledger at any prior timestamp.",
      "Vault (vault): Secure, tamper-proof repository for invoices, bill receipts, tax forms, and compliance documents.",
      "Forecaster (forecaster): Monte Carlo cash flow simulation and runway projection engine.",
      "AI Co-pilot (copilot): Natural language financial queries, pattern recognition, and ledger analysis.",
      "Account Register (register): Single-account checkbook register with inline transaction recording.",
      "Audit Trail (audit-trail): Immutable forensic log of every write, reversal, and user modification.",
      "API Platform (api-hub): Manage webhook endpoints, API tokens, and programmatic integrations."
    ],
    tips: [
      "Press ⌘K or Ctrl+K anytime to quickly jump to any of these views by typing its name."
    ]
  }
];

export default function HelpGuideView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedSection, setSelectedSection] = useState(GUIDE_SECTIONS[0]);
  const setActiveTab = useUIStore(state => state.setActiveTab);

  const categories = ["All", ...Array.from(new Set(GUIDE_SECTIONS.map(s => s.category)))];

  const filteredSections = GUIDE_SECTIONS.filter(section => {
    const matchesCategory = activeCategory === "All" || section.category === activeCategory;
    const matchesQuery = searchQuery.trim() === "" || 
      section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.steps.some(st => st.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--surface)] text-[var(--text)] overflow-hidden">
      <div className="p-6 md:p-8 border-b border-[var(--line)] bg-[var(--surface)] shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--brass-soft)] border border-[var(--brass-line)] flex items-center justify-center text-[var(--brass)]">
                <BookOpen size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">Help & Operational Guide</h1>
                <p className="text-xs text-[var(--muted)] font-medium">Standard operating procedures, workflows, and core architectural concepts</p>
              </div>
            </div>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <input
              type="text"
              placeholder="Search guide & workflows..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl text-sm font-medium outline-none focus:border-[var(--brass)] transition-colors placeholder:text-[var(--faint)]"
            />
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex items-center gap-2 mt-6 overflow-x-auto pb-1 custom-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={"px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors " + (
                activeCategory === cat
                  ? "bg-[var(--brass)] text-black font-bold shadow-xs"
                  : "bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--text)] border border-[var(--line)]"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row max-w-7xl mx-auto w-full">
        <div className="w-full md:w-80 border-r border-[var(--line)] overflow-y-auto p-4 space-y-2 shrink-0 custom-scrollbar">
          {filteredSections.map(section => {
            const Icon = section.icon;
            const isSelected = selectedSection.id === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setSelectedSection(section)}
                className={"w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 " + (
                  isSelected
                    ? "bg-[var(--brass-soft)] border-[var(--brass-line)] text-[var(--text)]"
                    : "bg-[var(--surface)] border-transparent hover:bg-[var(--panel)] hover:border-[var(--line)] text-[var(--muted)]"
                )}
              >
                <div className={"p-2 rounded-lg shrink-0 " + (isSelected ? "bg-[var(--brass)] text-black" : "bg-[var(--panel)] text-[var(--muted)]")}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--faint)]">{section.category}</span>
                    <ChevronRight size={14} className={isSelected ? "text-[var(--brass)]" : "text-transparent"} />
                  </div>
                  <h4 className="text-sm font-bold truncate mt-0.5">{section.title}</h4>
                  <p className="text-xs text-[var(--muted)] line-clamp-1 mt-0.5">{section.summary}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
          <motion.div
            key={selectedSection.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-6 max-w-3xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[var(--brass-soft)] border border-[var(--brass-line)] flex items-center justify-center text-[var(--brass)]">
                <selectedSection.icon size={24} />
              </div>
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[var(--brass)]">{selectedSection.category}</span>
                <h2 className="text-2xl font-black tracking-tight">{selectedSection.title}</h2>
              </div>
            </div>

            <p className="text-sm text-[var(--muted)] leading-relaxed bg-[var(--panel)] p-4 rounded-xl border border-[var(--line)]">
              {selectedSection.summary}
            </p>

            <div className="space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--faint)]">Step-by-Step Instructions</h3>
              <div className="space-y-3">
                {selectedSection.steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3.5 bg-[var(--panel)] rounded-xl border border-[var(--line)]">
                    <span className="w-6 h-6 rounded-full bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-xs font-mono font-bold shrink-0 text-[var(--brass)]">
                      {idx + 1}
                    </span>
                    <p className="text-sm font-medium leading-normal">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {selectedSection.tips && selectedSection.tips.length > 0 && (
              <div className="space-y-3 bg-[var(--brass-soft)] border border-[var(--brass-line)] p-4 rounded-xl">
                <div className="flex items-center gap-2 text-[var(--brass)] font-bold text-xs uppercase tracking-wider">
                  <Sparkles size={14} />
                  <span>Important Operational Tips</span>
                </div>
                <ul className="space-y-1.5 pl-5 list-disc text-xs text-[var(--text)] leading-relaxed">
                  {selectedSection.tips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-6 border-t border-[var(--line)] flex items-center justify-between">
              <button
                onClick={() => setActiveTab("support")}
                className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] transition-colors"
              >
                <span>Need more help? Open a Support Ticket</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
