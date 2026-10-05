import { useDialog } from '../../../hooks/useDialog';
import React, { useState, useMemo, useId } from 'react';
import { AutoRule, Transaction } from '../../../types';
import { useLedgerStore } from '../../../stores/useLedgerStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useCurrentRole } from '../../../hooks/useCurrentRole';
import { dryRunRules, sortRulesByPriority, evaluateRuleCondition } from '../../../lib/rulesEngine';
import { useTimeout } from '../../../hooks/useTimeout';
import { aiService } from '../../../services/aiService';
import { AutoRuleSchema } from '../../../schemas';
import { useAutoRules } from '../../../hooks/useAutoRules';
import { RulesSettingsView } from './RulesSettingsView';
function withOccurrenceKeys<T>(items: T[], keyForItem: (item: T) => string) {
  const occurrences = new Map<string, number>();
  return items.map(item => {
    const contentKey = keyForItem(item);
    const occurrence = occurrences.get(contentKey) ?? 0;
    occurrences.set(contentKey, occurrence + 1);
    return { item, key: JSON.stringify([contentKey, occurrence]) };
  });
}

function useRulesSettingsModel() {
  const formId = useId();
  const currentRole = useCurrentRole();
  const canBuildRules = currentRole === 'owner' || currentRole === 'accountant';

  const autoRules = useLedgerStore(s => (s.autoRules || []) as AutoRule[]);
  const { saveRule, setRuleActive, deleteRule, applyToExisting } = useAutoRules();
  const transactions = useLedgerStore(s => s.transactions);
  useLedgerStore(s => s.setTransactions);
  const getCurrentWorkspace = useAuthStore(s => s.getCurrentWorkspace);
  const user = useAuthStore(s => s.user);
  const currentWorkspace = getCurrentWorkspace();

  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const { dialogProps: overlay2DialogProps, titleId: overlay2TitleId } = useDialog(() => setIsCreatingRule(false), isCreatingRule);
  const [editingRule, setEditingRule] = useState<AutoRule | null>(null);

  // AI Rule Builder State
  const [aiSentence, setAiSentence] = useState('');
  const [isGeneratingAiRule, setIsGeneratingAiRule] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPreview, setAiPreview] = useState<{ rule: AutoRule; affectedCount: number } | null>(null);

  // Dry run & Test state
  const [dryRunResult, setDryRunResult] = useState<ReturnType<typeof dryRunRules> | null>(null);
  const [isTestingRule, setIsTestingRule] = useState(false);
  const { dialogProps: overlay1DialogProps, titleId: overlay1TitleId } = useDialog(() => setIsTestingRule(false), !!(isTestingRule && dryRunResult));
  const [isApplyingExisting, setIsApplyingExisting] = useState(false);
  const [applySuccessMessage, setApplySuccessMessage] = useState<string | null>(null);
  const { setSafeTimeout } = useTimeout();

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
    const rule = autoRules.find(r => r.id === ruleId);
    if (rule) void setRuleActive(ruleId, rule.isActive === false);
  };

  const handleDeleteRule = (ruleId: string) => {
    void deleteRule(ruleId);
  };

  const handleDuplicateRule = (rule: AutoRule) => {
    const newRule: AutoRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${rule.name || 'Rule'} (Copy)`,
      hitCount: 0,
      createdAt: new Date().toISOString()
    };
    void saveRule(newRule);
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

  const handleSaveRule = async () => {
    const tags = formAddTags.split(',').map(t => t.trim()).filter(Boolean);
    const amountThresh = formAmountThreshold ? parseFloat(formAmountThreshold) : undefined;

    const ruleData: AutoRule = {
      id: editingRule ? editingRule.id : `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      uid: editingRule?.uid || user?.uid || '',
      workspaceId: currentWorkspace?.id || '',
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

    if (await saveRule(ruleData)) setIsCreatingRule(false);
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

  const handleGenerateAiRule = async () => {
    if (!aiSentence.trim()) return;
    setIsGeneratingAiRule(true);
    setAiError(null);
    try {
      const accountsList = useLedgerStore.getState().accounts;
      const categories = Array.from(new Set(accountsList.map(a => a.category).filter(Boolean)));
      const accountNames = accountsList.map(a => a.name).filter(Boolean);
      const result = await aiService.process('build-auto-rule', { 
        sentence: aiSentence,
        categories,
        accounts: accountNames
      });
      const rawRule = result?.rule || result;
      const validated = AutoRuleSchema.safeParse({
        ...rawRule,
        id: `rule_ai_${Date.now()}`,
        workspaceId: currentWorkspace?.id || 'default',
        createdBy: 'ai',
        name: rawRule?.name || `AI Rule: ${aiSentence.slice(0, 30)}`
      });

      if (!validated.success) {
        setAiError('AI generated an invalid rule structure.');
        setIsGeneratingAiRule(false);
        return;
      }

      const generatedRule = validated.data as AutoRule;
      const dryRunRes = dryRunRules([generatedRule], transactions);

      setAiPreview({
        rule: generatedRule,
        affectedCount: dryRunRes.summary.totalMatched
      });
    } catch (err: any) {
      setAiError(err.message || 'Failed to generate AI rule');
    } finally {
      setIsGeneratingAiRule(false);
    }
  };

  const handleSaveAiRule = async (activate: boolean) => {
    if (!aiPreview) return;
    const ruleToSave: AutoRule = {
      ...aiPreview.rule,
      isActive: activate
    };
    if (!(await saveRule(ruleToSave))) return;
    setAiPreview(null);
    setAiSentence('');
  };

  const handleRunDryRun = () => {
    const result = dryRunRules(autoRules, transactions);
    setDryRunResult(result);
    setIsTestingRule(true);
  };

  const handleApplyToExisting = async () => {
    setIsApplyingExisting(true);
    try {
      const modified = await applyToExisting(autoRules, transactions);
      if (modified === 0) return;
      setApplySuccessMessage(`Applied the rules to ${modified} transactions (saved).`);
      setIsTestingRule(false);
      setSafeTimeout(() => setApplySuccessMessage(null), 5000);
    } finally {
      setIsApplyingExisting(false);
    }
  };

  return { withOccurrenceKeys, formId, currentRole, canBuildRules, autoRules, selectedGroup, setSelectedGroup, searchQuery, setSearchQuery, isCreatingRule, setIsCreatingRule, overlay2DialogProps, overlay2TitleId, editingRule, aiSentence, setAiSentence, isGeneratingAiRule, aiError, aiPreview, setAiPreview, dryRunResult, isTestingRule, setIsTestingRule, overlay1DialogProps, overlay1TitleId, isApplyingExisting, applySuccessMessage, setApplySuccessMessage, formName, setFormName, formGroup, setFormGroup, formDescContains, setFormDescContains, formVendor, setFormVendor, formCategory, setFormCategory, formAmountThreshold, setFormAmountThreshold, formTargetCategory, setFormTargetCategory, formTargetClass, setFormTargetClass, formTargetLocation, setFormTargetLocation, formAddTags, setFormAddTags, formFlagForReview, setFormFlagForReview, formStopOnMatch, setFormStopOnMatch, singleRuleTestResult, groups, filteredRules, handleToggleActive, handleDeleteRule, handleDuplicateRule, openCreateModal, openEditModal, handleSaveRule, handleTestSingleRule, handleGenerateAiRule, handleSaveAiRule, handleRunDryRun, handleApplyToExisting };
}

export type RulesSettingsModel = NonNullable<ReturnType<typeof useRulesSettingsModel>>;

export const RulesSettings: React.FC = () => {
  const model = useRulesSettingsModel();
  return <RulesSettingsView {...model} />;
};

export default RulesSettings;
