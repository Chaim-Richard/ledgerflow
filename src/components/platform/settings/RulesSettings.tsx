import React, { useState, useMemo } from 'react';
import { AutoRule, Transaction } from '../../../types';
import { useLedgerStore } from '../../../stores/useLedgerStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { dryRunRules, executeRulesOnTransactions, sortRulesByPriority, evaluateRuleCondition } from '../../../lib/rulesEngine';
import { 
  SlidersHorizontal, 
  Plus, 
  Play, 
  Trash2, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpDown, 
  Filter, 
  Tag, 
  FolderPlus,
  RotateCw,
  Search,
  Eye,
  Check,
  X
} from 'lucide-react';

export const RulesSettings: React.FC = () => {
  const autoRules = useLedgerStore(s => (s.autoRules || []) as AutoRule[]);
  const setAutoRules = useLedgerStore(s => s.setAutoRules);
  const transactions = useLedgerStore(s => s.transactions);
  const setTransactions = useLedgerStore(s => s.setTransactions);
  const updateTransaction = useLedgerStore(s => s.updateTransaction);
  const getCurrentWorkspace = useAuthStore(s => s.getCurrentWorkspace);
  const user = useAuthStore(s => s.user);
  const currentWorkspace = getCurrentWorkspace();

  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoRule | null>(null);

  // Dry run & Test state
  const [dryRunResult, setDryRunResult] = useState<ReturnType<typeof dryRunRules> | null>(null);
  const [isTestingRule, setIsTestingRule] = useState(false);
  const [isApplyingExisting, setIsApplyingExisting] = useState(false);
  const [applySuccessMessage, setApplySuccessMessage] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formGroup, setFormGroup] = useState('General');
  const [formPriority, setFormPriority] = useState(10);
  const [formDescContains, setFormDescContains] = useState('');
  const [formVendor, setFormVendor] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formAmountThreshold, setFormAmountThreshold] = useState<string>('');
  const [formTargetCategory, setFormTargetCategory] = useState('');
  const [formTargetClass, setFormTargetClass] = useState('');
  const [formTargetLocation, setFormTargetLocation] = useState('');
  const [formAddTags, setFormAddTags] = useState('');
  const [formDescPrefix, setFormDescPrefix] = useState('');
  const [formFlagForReview, setFormFlagForReview] = useState(false);
  const [formStopOnMatch, setFormStopOnMatch] = useState(false);
  const [singleRuleTestResult, setSingleRuleTestResult] = useState<Transaction[] | null>(null);

  const sortedRules = useMemo(() => {
    return sortRulesByPriority(autoRules);
  }, [autoRules]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    autoRules.forEach(r => {
      if (r.groupName) set.add(r.groupName);
      else set.add('General');
    });
    return Array.from(set);
  }, [autoRules]);

  const filteredRules = useMemo(() => {
    return sortedRules.filter(r => {
      if (selectedGroup !== 'all') {
        const group = r.groupName || 'General';
        if (group !== selectedGroup) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (r.name || r.id).toLowerCase();
        const desc = (r.condition.descriptionContains || '').toLowerCase();
        const vendor = (r.condition.vendor || '').toLowerCase();
        if (!name.includes(q) && !desc.includes(q) && !vendor.includes(q)) return false;
      }
      return true;
    });
  }, [sortedRules, selectedGroup, searchQuery]);

  const handleToggleActive = (ruleId: string) => {
    const updated = autoRules.map(r => r.id === ruleId ? { ...r, isActive: r.isActive === false ? true : false } : r);
    setAutoRules(updated);
  };

  const handleDeleteRule = (ruleId: string) => {
    const updated = autoRules.filter(r => r.id !== ruleId);
    setAutoRules(updated);
  };

  const handleDuplicateRule = (rule: AutoRule) => {
    const newRule: AutoRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${rule.name || 'Rule'} (Copy)`,
      hitCount: 0,
      createdAt: new Date().toISOString()
    };
    setAutoRules([...autoRules, newRule]);
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setFormName('');
    setFormGroup('General');
    setFormPriority(autoRules.length * 10 + 10);
    setFormDescContains('');
    setFormVendor('');
    setFormCategory('');
    setFormAmountThreshold('');
    setFormTargetCategory('');
    setFormTargetClass('');
    setFormTargetLocation('');
    setFormAddTags('');
    setFormDescPrefix('');
    setFormFlagForReview(false);
    setFormStopOnMatch(false);
    setSingleRuleTestResult(null);
    setIsCreatingRule(true);
  };

  const openEditModal = (rule: AutoRule) => {
    setEditingRule(rule);
    setFormName(rule.name || '');
    setFormGroup(rule.groupName || 'General');
    setFormPriority(rule.priority ?? 10);
    setFormDescContains(rule.condition.descriptionContains || '');
    setFormVendor(rule.condition.vendor || '');
    setFormCategory(rule.condition.category || '');
    setFormAmountThreshold(rule.condition.amountThreshold ? String(rule.condition.amountThreshold) : '');
    setFormTargetCategory(rule.action.targetCategory || '');
    setFormTargetClass(rule.action.targetClass || '');
    setFormTargetLocation(rule.action.targetLocation || '');
    setFormAddTags(rule.action.addTags?.join(', ') || rule.action.targetTags?.join(', ') || '');
    setFormDescPrefix(rule.action.descriptionPrefix || '');
    setFormFlagForReview(rule.action.flagForReview || false);
    setFormStopOnMatch(rule.stopProcessingOnMatch || false);
    setSingleRuleTestResult(null);
    setIsCreatingRule(true);
  };

  const handleSaveRule = () => {
    const tags = formAddTags.split(',').map(t => t.trim()).filter(Boolean);
    const amountThresh = formAmountThreshold ? parseFloat(formAmountThreshold) : undefined;

    const ruleData: AutoRule = {
      id: editingRule ? editingRule.id : `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      uid: user?.uid || 'system',
      workspaceId: currentWorkspace?.id || 'default',
      name: formName || `Rule: ${formDescContains || formVendor || 'Untitled'}`,
      groupName: formGroup || 'General',
      priority: Number(formPriority) || 10,
      isActive: true,
      stopProcessingOnMatch: formStopOnMatch,
      confidence: 1.0,
      isHardened: true,
      hitCount: editingRule?.hitCount || 0,
      createdAt: editingRule?.createdAt || new Date().toISOString(),
      condition: {
        descriptionContains: formDescContains || undefined,
        vendor: formVendor || undefined,
        category: formCategory || undefined,
        amountThreshold: isNaN(amountThresh as number) ? undefined : amountThresh
      },
      action: {
        targetCategory: formTargetCategory || undefined,
        targetClass: formTargetClass || undefined,
        targetLocation: formTargetLocation || undefined,
        addTags: tags.length > 0 ? tags : undefined,
        descriptionPrefix: formDescPrefix || undefined,
        flagForReview: formFlagForReview || undefined
      }
    };

    if (editingRule) {
      setAutoRules(autoRules.map(r => r.id === editingRule.id ? ruleData : r));
    } else {
      setAutoRules([...autoRules, ruleData]);
    }
    setIsCreatingRule(false);
  };

  const handleTestSingleRule = () => {
    const tags = formAddTags.split(',').map(t => t.trim()).filter(Boolean);
    const amountThresh = formAmountThreshold ? parseFloat(formAmountThreshold) : undefined;

    const tempRule: AutoRule = {
      id: 'test-rule',
      uid: 'test',
      name: formName || 'Test Rule',
      confidence: 1,
      isHardened: true,
      createdAt: new Date().toISOString(),
      condition: {
        descriptionContains: formDescContains || undefined,
        vendor: formVendor || undefined,
        category: formCategory || undefined,
        amountThreshold: isNaN(amountThresh as number) ? undefined : amountThresh
      },
      action: {
        targetCategory: formTargetCategory || undefined,
        targetClass: formTargetClass || undefined,
        targetLocation: formTargetLocation || undefined,
        addTags: tags.length > 0 ? tags : undefined,
        descriptionPrefix: formDescPrefix || undefined,
        flagForReview: formFlagForReview || undefined
      }
    };

    const matches = transactions.filter(t => evaluateRuleCondition(tempRule, t));
    setSingleRuleTestResult(matches);
  };

  const handleRunDryRun = () => {
    const result = dryRunRules(autoRules, transactions);
    setDryRunResult(result);
    setIsTestingRule(true);
  };

  const handleApplyToExisting = async () => {
    setIsApplyingExisting(true);
    try {
      const result = await executeRulesOnTransactions(
        autoRules,
        transactions,
        (updatedTx) => {
          updateTransaction(updatedTx.id, updatedTx);
        }
      );

      // Update hit counts
      const dry = dryRunRules(autoRules, transactions);
      const updatedRules = autoRules.map(r => {
        const hits = dry.summary.rulesTriggered[r.id] || 0;
        return hits > 0 ? { ...r, hitCount: (r.hitCount || 0) + hits, lastTriggeredAt: new Date().toISOString() } : r;
      });
      setAutoRules(updatedRules);

      setApplySuccessMessage(`Successfully applied automation rules to ${result.modifiedCount} matching transactions.`);
      setIsTestingRule(false);
      setTimeout(() => setApplySuccessMessage(null), 5000);
    } finally {
      setIsApplyingExisting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" id="rules-settings-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-neutral-700" />
            Rules & Automation Engine
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Automate categorization, tagging, classification, and validation across all past and future transactions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunDryRun}
            className="px-3.5 py-2 text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg flex items-center gap-1.5 transition-colors border border-neutral-300"
            id="test-all-rules-btn"
          >
            <Play className="w-3.5 h-3.5 text-neutral-700" />
            Test Against Ledger
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
            id="create-new-rule-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Rule
          </button>
        </div>
      </div>

      {applySuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{applySuccessMessage}</span>
          </div>
          <button onClick={() => setApplySuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Group & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedGroup('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              selectedGroup === 'all'
                ? 'bg-white text-neutral-900 shadow-xs border border-neutral-300'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            All Rules ({autoRules.length})
          </button>
          {groups.map(group => (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                selectedGroup === group
                  ? 'bg-white text-neutral-900 shadow-xs border border-neutral-300'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {group}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search rules..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-md bg-white focus:outline-hidden focus:ring-1 focus:ring-neutral-400"
          />
        </div>
      </div>

      {/* Rules Table */}
      {filteredRules.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-neutral-200 p-6">
          <SlidersHorizontal className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-800">No automation rules configured</h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
            Create deterministic rules to automatically match incoming transactions, assign chart-of-accounts categories, and append analytical coordinates.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 px-4 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add First Rule
          </button>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-16">Active</th>
                <th className="py-2.5 px-3">Rule Name & Group</th>
                <th className="py-2.5 px-3">When Transaction Matches</th>
                <th className="py-2.5 px-3">Actions Applied</th>
                <th className="py-2.5 px-3 text-center">Hits</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredRules.map((rule) => {
                const isActive = rule.isActive !== false;
                return (
                  <tr key={rule.id} className={`hover:bg-neutral-50/80 transition-colors ${!isActive ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => handleToggleActive(rule.id)}
                        className="rounded-sm border-neutral-300 text-neutral-900 focus:ring-neutral-500 h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-neutral-900">{rule.name || rule.id}</div>
                      <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                        <span className="bg-neutral-100 px-1.5 py-0.5 rounded-sm border border-neutral-200">
                          {rule.groupName || 'General'}
                        </span>
                        <span>Priority #{rule.priority ?? 10}</span>
                        {rule.stopProcessingOnMatch && (
                          <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-sm">Stop on match</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-neutral-700 space-y-0.5">
                      {rule.condition.descriptionContains && (
                        <div>Desc contains: <span className="font-semibold text-neutral-900">"{rule.condition.descriptionContains}"</span></div>
                      )}
                      {rule.condition.vendor && (
                        <div>Vendor: <span className="font-semibold text-neutral-900">"{rule.condition.vendor}"</span></div>
                      )}
                      {rule.condition.category && (
                        <div>Category: <span className="font-semibold text-neutral-900">{rule.condition.category}</span></div>
                      )}
                      {rule.condition.amountThreshold && (
                        <div>Amount &ge; <span className="font-semibold text-neutral-900">${rule.condition.amountThreshold}</span></div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-neutral-700 space-y-0.5">
                      {rule.action.targetCategory && (
                        <div className="flex items-center gap-1">
                          <span className="text-neutral-500">Categorize:</span>
                          <span className="font-medium text-neutral-900 bg-neutral-100 px-1.5 py-0.2 rounded-sm border border-neutral-200">
                            {rule.action.targetCategory}
                          </span>
                        </div>
                      )}
                      {rule.action.targetClass && (
                        <div className="flex items-center gap-1">
                          <span className="text-neutral-500">Class:</span>
                          <span className="font-medium text-neutral-900">{rule.action.targetClass}</span>
                        </div>
                      )}
                      {rule.action.targetLocation && (
                        <div className="flex items-center gap-1">
                          <span className="text-neutral-500">Location:</span>
                          <span className="font-medium text-neutral-900">{rule.action.targetLocation}</span>
                        </div>
                      )}
                      {rule.action.addTags && rule.action.addTags.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-neutral-400" />
                          <span>{rule.action.addTags.join(', ')}</span>
                        </div>
                      )}
                      {rule.action.flagForReview && (
                        <div className="text-amber-700 font-medium">Flag for review</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-neutral-100 text-neutral-700 rounded-full">
                        {rule.hitCount || 0}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-1">
                      <button
                        onClick={() => openEditModal(rule)}
                        className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                        title="Edit Rule"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDuplicateRule(rule)}
                        className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                        title="Duplicate Rule"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition-colors"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dry Run / Test Results Modal */}
      {isTestingRule && dryRunResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div>
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-600" />
                  Ledger Rules Dry-Run Simulation
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Scanned {dryRunResult.summary.totalScanned} transactions. Found {dryRunResult.summary.totalMatched} matches ready to update.
                </p>
              </div>
              <button onClick={() => setIsTestingRule(false)} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {dryRunResult.matches.length === 0 ? (
                <div className="text-center py-10 text-neutral-500 text-xs">
                  No existing transactions matched any active rule conditions.
                </div>
              ) : (
                <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden">
                  {dryRunResult.matches.slice(0, 50).map((match, idx) => (
                    <div key={idx} className="p-3 bg-white text-xs hover:bg-neutral-50 flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-neutral-900">
                          {match.txOriginal.date} — {match.txOriginal.description} (${(match.txOriginal.totalAmountCents / 100).toFixed(2)})
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          Matched rule: <span className="font-medium text-neutral-800">"{match.matchedRule.name || match.matchedRule.id}"</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {match.changes.map((c, i) => (
                            <span key={i} className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-sm text-[10px] font-medium">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-neutral-400">
                        TX ID: {match.transactionId.slice(0, 8)}...
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <button
                onClick={() => setIsTestingRule(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Close Preview
              </button>
              <button
                onClick={handleApplyToExisting}
                disabled={isApplyingExisting || dryRunResult.matches.length === 0}
                className="px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                {isApplyingExisting ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    Applying Rules...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Apply {dryRunResult.matches.length} Updates to Ledger
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Rule Modal */}
      {isCreatingRule && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <h3 className="text-base font-bold text-neutral-900">
                {editingRule ? 'Edit Automation Rule' : 'Create Automation Rule'}
              </h3>
              <button onClick={() => setIsCreatingRule(false)} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-neutral-700 mb-1">Rule Name</label>
                  <input
                    type="text"
                    placeholder="e.g. AWS Cloud Services"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full p-2 border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Rule Group</label>
                  <input
                    type="text"
                    placeholder="General / SaaS / Vendors"
                    value={formGroup}
                    onChange={e => setFormGroup(e.target.value)}
                    className="w-full p-2 border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Conditions */}
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
                <div className="font-bold text-neutral-800 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-neutral-600" />
                  IF Transaction Matches (Conditions)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-600 mb-1">Description contains</label>
                    <input
                      type="text"
                      placeholder="e.g. AMZN, GSUITE, UBER"
                      value={formDescContains}
                      onChange={e => setFormDescContains(e.target.value)}
                      className="w-full p-2 bg-white border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-600 mb-1">Vendor / Payee</label>
                    <input
                      type="text"
                      placeholder="e.g. Amazon Web Services"
                      value={formVendor}
                      onChange={e => setFormVendor(e.target.value)}
                      className="w-full p-2 bg-white border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-600 mb-1">Current Category / Account</label>
                    <input
                      type="text"
                      placeholder="e.g. Uncategorized"
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                      className="w-full p-2 bg-white border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-600 mb-1">Amount &ge; ($ threshold)</label>
                    <input
                      type="number"
                      placeholder="e.g. 500"
                      value={formAmountThreshold}
                      onChange={e => setFormAmountThreshold(e.target.value)}
                      className="w-full p-2 bg-white border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
                <div className="font-bold text-neutral-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-600" />
                  THEN Apply Actions
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-600 mb-1">Assign Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Software & Subscriptions"
                      value={formTargetCategory}
                      onChange={e => setFormTargetCategory(e.target.value)}
                      className="w-full p-2 bg-white border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-600 mb-1">Add Tags (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. saas, dev-tools, recurring"
                      value={formAddTags}
                      onChange={e => setFormAddTags(e.target.value)}
                      className="w-full p-2 bg-white border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-600 mb-1">Assign Class Dimension</label>
                    <input
                      type="text"
                      placeholder="e.g. Engineering, Sales, Ops"
                      value={formTargetClass}
                      onChange={e => setFormTargetClass(e.target.value)}
                      className="w-full p-2 bg-white border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-600 mb-1">Assign Location Dimension</label>
                    <input
                      type="text"
                      placeholder="e.g. HQ - New York"
                      value={formTargetLocation}
                      onChange={e => setFormTargetLocation(e.target.value)}
                      className="w-full p-2 bg-white border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formFlagForReview}
                      onChange={e => setFormFlagForReview(e.target.checked)}
                      className="rounded-sm border-neutral-300 text-neutral-900 focus:ring-neutral-500 h-4 w-4"
                    />
                    <span className="text-neutral-700">Flag for manual review</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formStopOnMatch}
                      onChange={e => setFormStopOnMatch(e.target.checked)}
                      className="rounded-sm border-neutral-300 text-neutral-900 focus:ring-neutral-500 h-4 w-4"
                    />
                    <span className="text-neutral-700">Stop processing lower-priority rules on match</span>
                  </label>
                </div>
              </div>

              {/* Test Rule Before Saving */}
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-800">Test Rule Against Historical Ledger</span>
                  <button
                    onClick={handleTestSingleRule}
                    type="button"
                    className="px-3 py-1.5 text-xs font-semibold bg-neutral-200 hover:bg-neutral-300 text-neutral-800 rounded-md transition-colors"
                  >
                    Run Test Check
                  </button>
                </div>
                {singleRuleTestResult !== null && (
                  <div className="mt-2 text-xs">
                    {singleRuleTestResult.length === 0 ? (
                      <p className="text-neutral-500 italic">No existing transactions match these conditions.</p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-emerald-700 font-semibold">
                          Matches {singleRuleTestResult.length} historical transaction{singleRuleTestResult.length > 1 ? 's' : ''}:
                        </p>
                        <div className="max-h-32 overflow-y-auto space-y-1 bg-white p-2 rounded-sm border border-neutral-200">
                          {singleRuleTestResult.slice(0, 5).map(tx => (
                            <div key={tx.id} className="text-[11px] text-neutral-600 truncate">
                              {tx.date} — {tx.description} (${(tx.totalAmountCents / 100).toFixed(2)})
                            </div>
                          ))}
                          {singleRuleTestResult.length > 5 && (
                            <div className="text-[10px] text-neutral-400">...and {singleRuleTestResult.length - 5} more</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <button
                onClick={() => setIsCreatingRule(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                className="px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RulesSettings;
