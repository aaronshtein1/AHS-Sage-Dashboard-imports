'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Link2, Info } from 'lucide-react';

type RuleType = 'MATCHING' | 'CREATION';

interface RuleEditorDialogProps {
  rule: any;
  ruleType: RuleType;
  onClose: () => void;
  onSave: () => void;
}

export function RuleEditorDialog({ rule, ruleType, onClose, onSave }: RuleEditorDialogProps) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 10,
    ruleType: ruleType,
    matchType: 'CONTAINS_TEXT',
    merchantPattern: '',
    descriptionPattern: '',
    // Creation rule fields
    assignToAccountId: '',
    defaultMemo: '',
    autoPost: false,
    // Matching rule fields
    amountTolerance: 0,
    dateTolerance: 3,
    matchByReference: false,
    referencePattern: '',
    ...rule,
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const data = await api.getChartOfAccounts();
    setAccounts(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      ruleType: ruleType,
    };
    if (rule) {
      await api.updateBankFeedRule(rule.id, payload);
    } else {
      await api.createBankFeedRule(payload);
    }
    onSave();
  };

  const isCreationRule = ruleType === 'CREATION';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCreationRule ? (
              <FileText className="h-5 w-5 text-zinc-600" />
            ) : (
              <Link2 className="h-5 w-5 text-zinc-600" />
            )}
            {rule ? 'Edit' : 'New'} {isCreationRule ? 'Creation' : 'Matching'} Rule
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label>Rule Name</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={isCreationRule ? 'e.g., Amazon Office Supplies' : 'e.g., Match Payroll Deposits'}
                required
              />
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={isCreationRule
                  ? 'Describe what this rule creates'
                  : 'Describe what journal entries this rule matches'}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: +e.target.value })
                  }
                />
                <p className="text-xs text-zinc-500 mt-1">Lower numbers run first</p>
              </div>

              <div>
                <Label>Match Type</Label>
                <Select
                  value={formData.matchType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, matchType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXACT_MERCHANT">Exact Merchant</SelectItem>
                    <SelectItem value="CONTAINS_TEXT">Contains Text</SelectItem>
                    <SelectItem value="REGEX_PATTERN">Regex Pattern</SelectItem>
                    <SelectItem value="CATEGORY_MATCH">Category Match</SelectItem>
                    <SelectItem value="AMOUNT_RANGE">Amount Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Pattern Matching */}
          <div className="border-t border-zinc-200 pt-4">
            <h4 className="text-sm font-medium text-zinc-900 mb-3">Transaction Matching</h4>

            {(formData.matchType === 'EXACT_MERCHANT' ||
              formData.matchType === 'CONTAINS_TEXT') && (
              <div>
                <Label>Merchant/Description Pattern</Label>
                <Input
                  value={formData.merchantPattern || formData.descriptionPattern}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      merchantPattern: e.target.value,
                      descriptionPattern: e.target.value,
                    })
                  }
                  placeholder="e.g., Amazon, Starbucks, Office Depot"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  {formData.matchType === 'EXACT_MERCHANT'
                    ? 'Must match exactly (case-insensitive)'
                    : 'Will match if transaction contains this text'}
                </p>
              </div>
            )}

            {formData.matchType === 'REGEX_PATTERN' && (
              <div>
                <Label>Regex Pattern</Label>
                <Input
                  value={formData.descriptionPattern}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      descriptionPattern: e.target.value,
                    })
                  }
                  placeholder="e.g., ^AMAZON.*|^AMZN.*"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-zinc-500 mt-1">Regular expression pattern</p>
              </div>
            )}

            {formData.matchType === 'AMOUNT_RANGE' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Minimum Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amountMin || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, amountMin: parseFloat(e.target.value) || undefined })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Maximum Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amountMax || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, amountMax: parseFloat(e.target.value) || undefined })
                    }
                    placeholder="1000.00"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Rule Type Specific Fields */}
          {isCreationRule ? (
            /* Creation Rule Fields */
            <div className="border-t border-zinc-200 pt-4">
              <h4 className="text-sm font-medium text-zinc-900 mb-3">Journal Entry Creation</h4>

              <div className="space-y-4">
                <div>
                  <Label>Expense/Asset Account</Label>
                  <Select
                    value={formData.assignToAccountId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, assignToAccountId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.accountCode} - {acc.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-zinc-500 mt-1">
                    The account to debit/credit based on transaction type
                  </p>
                </div>

                <div>
                  <Label>Default Memo</Label>
                  <Input
                    value={formData.defaultMemo}
                    onChange={(e) =>
                      setFormData({ ...formData, defaultMemo: e.target.value })
                    }
                    placeholder="Optional memo for journal entries"
                  />
                </div>

                <div className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <Checkbox
                    id="autoPost"
                    checked={formData.autoPost}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, autoPost: !!checked })
                    }
                  />
                  <div>
                    <Label htmlFor="autoPost" className="cursor-pointer">Auto-Post Journal Entries</Label>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Automatically post journal entries created by this rule (for high-confidence matches)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Matching Rule Fields */
            <div className="border-t border-zinc-200 pt-4">
              <h4 className="text-sm font-medium text-zinc-900 mb-3">Reconciliation Matching</h4>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-800">
                    Matching rules are used during bank reconciliation to find existing journal entries
                    that correspond to bank transactions. Configure how strictly to match.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Amount Tolerance ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amountTolerance}
                      onChange={(e) =>
                        setFormData({ ...formData, amountTolerance: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="0.00"
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                      Allow difference up to this amount
                    </p>
                  </div>

                  <div>
                    <Label>Date Tolerance (days)</Label>
                    <Input
                      type="number"
                      value={formData.dateTolerance}
                      onChange={(e) =>
                        setFormData({ ...formData, dateTolerance: parseInt(e.target.value) || 0 })
                      }
                      placeholder="3"
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                      Match entries within this many days
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <Checkbox
                    id="matchByReference"
                    checked={formData.matchByReference}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, matchByReference: !!checked })
                    }
                  />
                  <div className="flex-1">
                    <Label htmlFor="matchByReference" className="cursor-pointer">Match by Reference Number</Label>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Also match using journal entry reference numbers
                    </p>
                  </div>
                </div>

                {formData.matchByReference && (
                  <div>
                    <Label>Reference Pattern (optional)</Label>
                    <Input
                      value={formData.referencePattern}
                      onChange={(e) =>
                        setFormData({ ...formData, referencePattern: e.target.value })
                      }
                      placeholder="e.g., PAY-* or INV-*"
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                      Pattern to extract reference from bank transaction
                    </p>
                  </div>
                )}

                <div>
                  <Label>Journal Account Filter (optional)</Label>
                  <Select
                    value={formData.assignToAccountId || ''}
                    onValueChange={(value) =>
                      setFormData({ ...formData, assignToAccountId: value || '' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any account</SelectItem>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.accountCode} - {acc.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-zinc-500 mt-1">
                    Only match journal entries involving this account
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4 border-t border-zinc-200">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {rule ? 'Save Changes' : `Create ${isCreationRule ? 'Creation' : 'Matching'} Rule`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
