'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { RuleSuggestion, Account } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles, Check, X, ChevronRight, RefreshCw, Zap } from 'lucide-react';

export function RuleSuggestions() {
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [suggestionsData, accountsData] = await Promise.all([
        api.getRuleSuggestions(30),
        api.getChartOfAccounts(),
      ]);
      setSuggestions(suggestionsData);
      setAccounts(accountsData);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async (suggestion: RuleSuggestion, accountId?: string) => {
    if (!suggestion.suggestedRule) return;

    setCreating(suggestion.transactionId);
    try {
      await api.createRuleFromSuggestion(
        suggestion,
        accountId || suggestion.suggestedAccountId || undefined,
        suggestion.suggestedRule.autoPost
      );
      // Remove from list after creating
      setSuggestions((prev) => prev.filter((s) => s.transactionId !== suggestion.transactionId));
    } catch (error) {
      console.error('Failed to create rule:', error);
      alert('Failed to create rule');
    } finally {
      setCreating(null);
    }
  };

  const handleDismiss = (transactionId: string) => {
    setSuggestions((prev) => prev.filter((s) => s.transactionId !== transactionId));
  };

  const getConfidenceBadge = (confidence: string) => {
    const variants: Record<string, string> = {
      HIGH: 'bg-green-100 text-green-800 border-green-200',
      MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      LOW: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return (
      <Badge variant="outline" className={variants[confidence] || variants.LOW}>
        {confidence}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-zinc-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Analyzing transactions...</span>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">No suggestions available</p>
        <p className="text-sm mt-1">
          All your transactions either have rules or couldn&apos;t be automatically categorized.
        </p>
        <Button variant="outline" className="mt-4" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  // Group suggestions by category
  const groupedSuggestions = suggestions.reduce((acc, s) => {
    const category = s.suggestedCategory || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(s);
    return acc;
  }, {} as Record<string, RuleSuggestion[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-zinc-900">
            AI Rule Suggestions
          </h3>
          <Badge variant="outline">{suggestions.length} suggestions</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <p className="text-sm text-zinc-600">
        Based on your transaction patterns, we suggest creating these rules to automatically categorize future transactions.
      </p>

      {Object.entries(groupedSuggestions).map(([category, categorySuggestions]) => (
        <div key={category} className="space-y-3">
          <h4 className="text-sm font-medium text-zinc-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {category}
            <span className="text-zinc-400 font-normal">({categorySuggestions.length})</span>
          </h4>

          <div className="space-y-2">
            {categorySuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.transactionId}
                suggestion={suggestion}
                accounts={accounts}
                isCreating={creating === suggestion.transactionId}
                onCreateRule={handleCreateRule}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  accounts,
  isCreating,
  onCreateRule,
  onDismiss,
}: {
  suggestion: RuleSuggestion;
  accounts: Account[];
  isCreating: boolean;
  onCreateRule: (suggestion: RuleSuggestion, accountId?: string) => void;
  onDismiss: (transactionId: string) => void;
}) {
  const [selectedAccountId, setSelectedAccountId] = useState(suggestion.suggestedAccountId || '');
  const [expanded, setExpanded] = useState(false);

  const getConfidenceBadge = (confidence: string) => {
    const variants: Record<string, string> = {
      HIGH: 'bg-green-100 text-green-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      LOW: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded ${variants[confidence] || variants.LOW}`}>
        {confidence}
      </span>
    );
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 hover:border-zinc-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-zinc-900 truncate">
              {suggestion.merchantName || suggestion.transactionName}
            </span>
            {getConfidenceBadge(suggestion.confidence)}
          </div>

          <div className="text-sm text-zinc-500 mb-2">
            Pattern: <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-xs">{suggestion.matchedPattern}</code>
          </div>

          {suggestion.existingRule ? (
            <div className="text-sm text-amber-600">
              <Zap className="h-3 w-3 inline mr-1" />
              Similar rule exists: {suggestion.existingRule.name}
            </div>
          ) : suggestion.suggestedRule ? (
            <div className="flex items-center gap-3">
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="w-64 h-8 text-sm">
                  <SelectValue placeholder="Select GL account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.accountCode} - {acc.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                onClick={() => onCreateRule(suggestion, selectedAccountId)}
                disabled={isCreating || !selectedAccountId}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isCreating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Create Rule
                  </>
                )}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDismiss(suggestion.transactionId)}
                className="text-zinc-500"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="text-sm text-zinc-500 italic">
              No rule suggestion available
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-sm font-medium text-zinc-900">
            ${Math.abs(suggestion.amount).toFixed(2)}
          </div>
          {suggestion.suggestedAccountName && (
            <div className="text-xs text-zinc-500">
              → {suggestion.suggestedAccountCode}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
