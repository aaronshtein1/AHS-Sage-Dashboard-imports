"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Wand2,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";

export interface MatchingCondition {
  id: string;
  field: "description" | "amount" | "vendor" | "date";
  operator: "contains" | "equals" | "startsWith" | "endsWith" | "regex" | "greaterThan" | "lessThan";
  value: string;
}

export interface MatchingAction {
  id: string;
  type: "setVendor" | "setGLAccount" | "setDepartment" | "setLocation" | "setClass" | "setMemo";
  value: string;
}

export interface RuleBuilderProps {
  initialDescription?: string;
  initialAmount?: number;
  onCreateRule: (rule: {
    name: string;
    description?: string;
    priority: number;
    conditions: Omit<MatchingCondition, "id">[];
    actions: Omit<MatchingAction, "id">[];
  }) => Promise<void>;
  onCancel: () => void;
  glAccounts?: Array<{ id: string; name: string; number: string }>;
  departments?: Array<{ id: string; name: string }>;
  locations?: Array<{ id: string; name: string }>;
  vendors?: Array<{ id: string; name: string }>;
}

const FIELD_OPTIONS = [
  { value: "description", label: "Description" },
  { value: "amount", label: "Amount" },
  { value: "vendor", label: "Vendor" },
  { value: "date", label: "Date" },
];

const OPERATOR_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  description: [
    { value: "contains", label: "Contains" },
    { value: "equals", label: "Equals" },
    { value: "startsWith", label: "Starts with" },
    { value: "endsWith", label: "Ends with" },
    { value: "regex", label: "Matches regex" },
  ],
  amount: [
    { value: "equals", label: "Equals" },
    { value: "greaterThan", label: "Greater than" },
    { value: "lessThan", label: "Less than" },
  ],
  vendor: [
    { value: "contains", label: "Contains" },
    { value: "equals", label: "Equals" },
  ],
  date: [
    { value: "equals", label: "Equals" },
    { value: "greaterThan", label: "After" },
    { value: "lessThan", label: "Before" },
  ],
};

const ACTION_OPTIONS = [
  { value: "setVendor", label: "Set Vendor" },
  { value: "setGLAccount", label: "Set GL Account" },
  { value: "setDepartment", label: "Set Department" },
  { value: "setLocation", label: "Set Location" },
  { value: "setClass", label: "Set Class" },
  { value: "setMemo", label: "Set Memo" },
];

export function RuleBuilder({
  initialDescription,
  initialAmount,
  onCreateRule,
  onCancel,
  glAccounts = [],
  departments = [],
  locations = [],
  vendors = [],
}: RuleBuilderProps) {
  const [ruleName, setRuleName] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [priority, setPriority] = useState(10);
  const [conditions, setConditions] = useState<MatchingCondition[]>([
    {
      id: crypto.randomUUID(),
      field: "description",
      operator: "contains",
      value: initialDescription || "",
    },
  ]);
  const [actions, setActions] = useState<MatchingAction[]>([
    {
      id: crypto.randomUUID(),
      type: "setGLAccount",
      value: "",
    },
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auto-generate rule name from first condition
  const generateRuleName = () => {
    const firstCondition = conditions[0];
    if (firstCondition?.value) {
      // Extract key words from the description
      const words = firstCondition.value.split(/\s+/).slice(0, 3).join(" ");
      setRuleName(`Rule: ${words}`);
    }
  };

  const addCondition = () => {
    setConditions([
      ...conditions,
      {
        id: crypto.randomUUID(),
        field: "description",
        operator: "contains",
        value: "",
      },
    ]);
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<MatchingCondition>) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const addAction = () => {
    setActions([
      ...actions,
      {
        id: crypto.randomUUID(),
        type: "setGLAccount",
        value: "",
      },
    ]);
  };

  const removeAction = (id: string) => {
    setActions(actions.filter((a) => a.id !== id));
  };

  const updateAction = (id: string, updates: Partial<MatchingAction>) => {
    setActions(actions.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    // Validation
    if (!ruleName.trim()) {
      setError("Please enter a rule name");
      return;
    }

    if (conditions.some((c) => !c.value.trim())) {
      setError("All conditions must have a value");
      return;
    }

    if (actions.some((a) => !a.value.trim())) {
      setError("All actions must have a value");
      return;
    }

    setIsCreating(true);

    try {
      await onCreateRule({
        name: ruleName,
        description: ruleDescription || undefined,
        priority,
        conditions: conditions.map(({ field, operator, value }) => ({
          field,
          operator,
          value,
        })),
        actions: actions.map(({ type, value }) => ({ type, value })),
      });

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setIsCreating(false);
    }
  };

  // Get value options based on action type
  const getActionValueOptions = (actionType: string) => {
    switch (actionType) {
      case "setVendor":
        return vendors;
      case "setGLAccount":
        return glAccounts.map((a) => ({ id: a.id, name: `${a.number} - ${a.name}` }));
      case "setDepartment":
        return departments;
      case "setLocation":
        return locations;
      default:
        return [];
    }
  };

  if (success) {
    return (
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <CheckCircle className="mb-4 h-12 w-12 text-emerald-500" />
          <h3 className="mb-2 text-lg font-semibold text-emerald-900">
            Rule Created Successfully!
          </h3>
          <p className="mb-4 text-sm text-emerald-700">
            The matching rule &quot;{ruleName}&quot; has been created in Sage Intacct.
          </p>
          <Button onClick={onCancel}>Done</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          Create Matching Rule
        </CardTitle>
        <CardDescription>
          Define conditions to match transactions and actions to apply
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Rule Name & Priority */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium">Rule Name</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Amazon AWS Charges"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={generateRuleName}
                title="Auto-generate from conditions"
              >
                <Wand2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Priority</label>
            <Input
              type="number"
              min={1}
              max={100}
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 10)}
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Description (optional)</label>
          <Input
            placeholder="Optional description for this rule"
            value={ruleDescription}
            onChange={(e) => setRuleDescription(e.target.value)}
          />
        </div>

        {/* Conditions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              When transaction matches:
            </label>
            <Button variant="outline" size="sm" onClick={addCondition}>
              <Plus className="mr-1 h-4 w-4" />
              Add Condition
            </Button>
          </div>

          <div className="space-y-2">
            {conditions.map((condition, index) => (
              <div
                key={condition.id}
                className="flex items-center gap-2 rounded-lg bg-zinc-50 p-3"
              >
                {index > 0 && (
                  <Badge variant="secondary" className="mr-2">
                    AND
                  </Badge>
                )}

                {/* Field selector */}
                <select
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                  value={condition.field}
                  onChange={(e) =>
                    updateCondition(condition.id, {
                      field: e.target.value as MatchingCondition["field"],
                      operator: OPERATOR_OPTIONS[e.target.value]?.[0]?.value as MatchingCondition["operator"] || "contains",
                    })
                  }
                >
                  {FIELD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Operator selector */}
                <select
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                  value={condition.operator}
                  onChange={(e) =>
                    updateCondition(condition.id, {
                      operator: e.target.value as MatchingCondition["operator"],
                    })
                  }
                >
                  {OPERATOR_OPTIONS[condition.field]?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Value input */}
                <Input
                  className="flex-1"
                  placeholder="Value to match"
                  value={condition.value}
                  onChange={(e) =>
                    updateCondition(condition.id, { value: e.target.value })
                  }
                />

                {/* Remove button */}
                {conditions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(condition.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight className="h-6 w-6 text-zinc-400" />
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Then apply:</label>
            <Button variant="outline" size="sm" onClick={addAction}>
              <Plus className="mr-1 h-4 w-4" />
              Add Action
            </Button>
          </div>

          <div className="space-y-2">
            {actions.map((action) => {
              const valueOptions = getActionValueOptions(action.type);
              const hasOptions = valueOptions.length > 0;

              return (
                <div
                  key={action.id}
                  className="flex items-center gap-2 rounded-lg bg-blue-50 p-3"
                >
                  {/* Action type selector */}
                  <select
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                    value={action.type}
                    onChange={(e) =>
                      updateAction(action.id, {
                        type: e.target.value as MatchingAction["type"],
                        value: "", // Reset value when type changes
                      })
                    }
                  >
                    {ACTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {/* Value - either select or input */}
                  {hasOptions ? (
                    <select
                      className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                      value={action.value}
                      onChange={(e) =>
                        updateAction(action.id, { value: e.target.value })
                      }
                    >
                      <option value="">Select...</option>
                      {valueOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      className="flex-1"
                      placeholder="Enter value"
                      value={action.value}
                      onChange={(e) =>
                        updateAction(action.id, { value: e.target.value })
                      }
                    />
                  )}

                  {/* Remove button */}
                  {actions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAction(action.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit buttons */}
        <div className="flex justify-end gap-3 border-t pt-4">
          <Button variant="outline" onClick={onCancel} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating in Intacct...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Create Rule in Intacct
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
