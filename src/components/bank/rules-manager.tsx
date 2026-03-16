'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Link2, FileText } from 'lucide-react';
import { RuleEditorDialog } from './rule-editor-dialog';

type RuleType = 'MATCHING' | 'CREATION';

interface RulesManagerProps {
  initialTab?: RuleType;
}

export function RulesManager({ initialTab = 'CREATION' }: RulesManagerProps) {
  const [rules, setRules] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<RuleType>(initialTab);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setIsLoading(true);
    const data = await api.getBankFeedRules().catch(() => []);
    setRules(data);
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this rule?')) {
      await api.deleteBankFeedRule(id);
      loadRules();
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await api.updateBankFeedRule(id, { isActive: !isActive });
    loadRules();
  };

  // Filter rules by type
  const filteredRules = rules.filter(
    (rule) => (rule.ruleType || 'CREATION') === activeTab
  );

  const tabs = [
    {
      id: 'CREATION' as RuleType,
      label: 'Creation Rules',
      icon: FileText,
      description: 'Automatically create journal entries from bank transactions',
    },
    {
      id: 'MATCHING' as RuleType,
      label: 'Matching Rules',
      icon: Link2,
      description: 'Match bank transactions to existing journal entries during reconciliation',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="border-b border-zinc-200">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            {activeTab === 'CREATION' ? 'Creation Rules' : 'Matching Rules'}
          </h2>
          <p className="text-sm text-zinc-600">
            {activeTab === 'CREATION'
              ? 'Rules that automatically create journal entries from bank feed transactions'
              : 'Rules that match bank transactions to existing journal entries during reconciliation'}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingRule(null);
            setShowDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create {activeTab === 'CREATION' ? 'Creation' : 'Matching'} Rule
        </Button>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-lg border border-zinc-200">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left p-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Priority
              </th>
              <th className="text-left p-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Rule Name
              </th>
              <th className="text-left p-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Match Type
              </th>
              <th className="text-left p-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                {activeTab === 'CREATION' ? 'Creates JE With' : 'Matches To'}
              </th>
              {activeTab === 'CREATION' && (
                <th className="text-center p-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Auto-Post
                </th>
              )}
              <th className="text-center p-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                {activeTab === 'CREATION' ? 'Created' : 'Matched'}
              </th>
              <th className="text-center p-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Active
              </th>
              <th className="w-24 p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {isLoading ? (
              <tr>
                <td colSpan={activeTab === 'CREATION' ? 8 : 7} className="p-8 text-center text-zinc-500">
                  Loading rules...
                </td>
              </tr>
            ) : filteredRules.length === 0 ? (
              <tr>
                <td colSpan={activeTab === 'CREATION' ? 8 : 7} className="p-8 text-center text-zinc-500">
                  <div className="flex flex-col items-center gap-2">
                    {activeTab === 'CREATION' ? (
                      <FileText className="h-8 w-8 text-zinc-300" />
                    ) : (
                      <Link2 className="h-8 w-8 text-zinc-300" />
                    )}
                    <p>No {activeTab === 'CREATION' ? 'creation' : 'matching'} rules configured</p>
                    <p className="text-xs text-zinc-400">
                      {activeTab === 'CREATION'
                        ? 'Create rules to automatically generate journal entries from bank transactions'
                        : 'Create rules to match bank transactions with existing journal entries'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-zinc-50">
                  <td className="p-3 text-sm text-zinc-900 font-mono">
                    {rule.priority}
                  </td>
                  <td className="p-3">
                    <div className="text-sm font-medium text-zinc-900">
                      {rule.name}
                    </div>
                    {rule.description && (
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {rule.description}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="text-xs font-medium text-zinc-600 bg-zinc-100 px-2 py-1 rounded">
                      {rule.matchType?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-zinc-700">
                    {rule.assignToAccount?.title || rule.assignToAccount?.accountCode || '—'}
                  </td>
                  {activeTab === 'CREATION' && (
                    <td className="p-3 text-center">
                      {rule.autoPost ? (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
                          Yes
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                  )}
                  <td className="p-3 text-center text-sm text-zinc-600 font-mono">
                    {rule.matchCount || 0}
                  </td>
                  <td className="p-3 text-center">
                    <Checkbox
                      checked={rule.isActive}
                      onCheckedChange={() =>
                        handleToggleActive(rule.id, rule.isActive)
                      }
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingRule(rule);
                          setShowDialog(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-zinc-900 mb-1">
          {activeTab === 'CREATION' ? 'How Creation Rules Work' : 'How Matching Rules Work'}
        </h4>
        <p className="text-xs text-zinc-600">
          {activeTab === 'CREATION' ? (
            <>
              Creation rules automatically generate new journal entries when bank transactions match the rule criteria.
              When a bank feed transaction matches a creation rule, a corresponding journal entry is created with the
              specified account assignments. If <strong>Auto-Post</strong> is enabled, the journal entry will be
              automatically posted.
            </>
          ) : (
            <>
              Matching rules are used during the bank reconciliation process to automatically match bank transactions
              with existing journal entries. When you run reconciliation, these rules help identify which journal
              entries correspond to which bank transactions based on amount, date, and description patterns.
            </>
          )}
        </p>
      </div>

      {showDialog && (
        <RuleEditorDialog
          rule={editingRule}
          ruleType={activeTab}
          onClose={() => setShowDialog(false)}
          onSave={() => {
            setShowDialog(false);
            loadRules();
          }}
        />
      )}
    </div>
  );
}
