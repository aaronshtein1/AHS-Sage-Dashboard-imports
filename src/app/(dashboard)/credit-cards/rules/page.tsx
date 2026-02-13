"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Wand2,
  Plus,
  Search,
  Trash2,
  Edit,
  Copy,
  CheckCircle,
  AlertTriangle,
  ArrowUpDown,
  MoreVertical,
} from "lucide-react";

// Demo existing rules
const demoRules = [
  {
    id: "rule1",
    name: "Amazon AWS Charges",
    description: "Map all AWS charges to Cloud Services",
    priority: 1,
    conditions: [
      { field: "description", operator: "contains", value: "AMAZON WEB SERVICES" },
    ],
    actions: [
      { type: "setVendor", value: "Amazon Web Services" },
      { type: "setGLAccount", value: "6200 - Cloud Services" },
      { type: "setDepartment", value: "Engineering" },
    ],
    matchCount: 156,
    lastMatched: "2025-01-20",
    status: "active",
  },
  {
    id: "rule2",
    name: "Microsoft Azure",
    description: "Map Azure charges to Cloud Services",
    priority: 2,
    conditions: [
      { field: "description", operator: "contains", value: "MICROSOFT*AZURE" },
    ],
    actions: [
      { type: "setVendor", value: "Microsoft Azure" },
      { type: "setGLAccount", value: "6200 - Cloud Services" },
    ],
    matchCount: 89,
    lastMatched: "2025-01-19",
    status: "active",
  },
  {
    id: "rule3",
    name: "Uber Rides",
    description: "Map Uber charges to Travel",
    priority: 3,
    conditions: [
      { field: "description", operator: "contains", value: "UBER" },
    ],
    actions: [
      { type: "setVendor", value: "Uber Technologies" },
      { type: "setGLAccount", value: "6500 - Travel & Transportation" },
    ],
    matchCount: 234,
    lastMatched: "2025-01-20",
    status: "active",
  },
  {
    id: "rule4",
    name: "Zoom Subscriptions",
    description: "Map Zoom charges to Software",
    priority: 4,
    conditions: [
      { field: "description", operator: "contains", value: "ZOOM.US" },
    ],
    actions: [
      { type: "setVendor", value: "Zoom Video Communications" },
      { type: "setGLAccount", value: "6200 - Software Subscriptions" },
    ],
    matchCount: 12,
    lastMatched: "2025-01-18",
    status: "active",
  },
  {
    id: "rule5",
    name: "Delta Air Lines",
    description: "Map Delta flights to Travel",
    priority: 5,
    conditions: [
      { field: "description", operator: "contains", value: "DELTA AIR" },
    ],
    actions: [
      { type: "setVendor", value: "Delta Air Lines" },
      { type: "setGLAccount", value: "6500 - Travel & Transportation" },
    ],
    matchCount: 45,
    lastMatched: "2025-01-17",
    status: "active",
  },
  {
    id: "rule6",
    name: "Office Supplies - Staples",
    description: "Map Staples purchases to Office Supplies",
    priority: 6,
    conditions: [
      { field: "description", operator: "contains", value: "STAPLES" },
    ],
    actions: [
      { type: "setVendor", value: "Staples Inc." },
      { type: "setGLAccount", value: "6100 - Office Supplies" },
    ],
    matchCount: 67,
    lastMatched: "2025-01-18",
    status: "active",
  },
  {
    id: "rule7",
    name: "Small Amount Meals",
    description: "Auto-categorize small meal purchases",
    priority: 10,
    conditions: [
      { field: "amount", operator: "lessThan", value: "50" },
      { field: "description", operator: "contains", value: "DOORDASH" },
    ],
    actions: [
      { type: "setGLAccount", value: "6400 - Meals & Entertainment" },
    ],
    matchCount: 189,
    lastMatched: "2025-01-20",
    status: "active",
  },
  {
    id: "rule8",
    name: "Deprecated - Old AWS",
    description: "Old AWS rule (disabled)",
    priority: 99,
    conditions: [
      { field: "description", operator: "equals", value: "AWS" },
    ],
    actions: [
      { type: "setGLAccount", value: "6200 - Cloud Services" },
    ],
    matchCount: 0,
    lastMatched: null,
    status: "disabled",
  },
];

export default function MatchingRulesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRule, setSelectedRule] = useState<string | null>(null);

  // Filter rules
  const filteredRules = demoRules.filter(
    (rule) =>
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const activeRules = demoRules.filter((r) => r.status === "active").length;
  const totalMatches = demoRules.reduce((s, r) => s + r.matchCount, 0);

  return (
    <div className="flex flex-col">
      <Header
        title="Matching Rules"
        subtitle="Manage credit card transaction auto-categorization rules"
      >
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Rule
        </Button>
      </Header>

      <div className="p-6">
        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-lg bg-blue-100 p-3">
                <Wand2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeRules}</p>
                <p className="text-sm text-zinc-500">Active Rules</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-lg bg-emerald-100 p-3">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMatches}</p>
                <p className="text-sm text-zinc-500">Total Matches</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-lg bg-amber-100 p-3">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {demoRules.filter((r) => r.status === "disabled").length}
                </p>
                <p className="text-sm text-zinc-500">Disabled Rules</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rules Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5" />
                  All Matching Rules
                </CardTitle>
                <CardDescription>
                  Rules are applied in priority order (lower number = higher priority)
                </CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Search rules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">
                    <div className="flex items-center gap-1">
                      Priority
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead className="text-right">Matches</TableHead>
                  <TableHead>Last Match</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => (
                  <TableRow
                    key={rule.id}
                    className={cn(
                      "cursor-pointer",
                      selectedRule === rule.id && "bg-blue-50",
                      rule.status === "disabled" && "opacity-60"
                    )}
                    onClick={() =>
                      setSelectedRule(selectedRule === rule.id ? null : rule.id)
                    }
                  >
                    <TableCell className="font-mono text-center">
                      {rule.priority}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-sm text-zinc-500">{rule.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rule.conditions.map((cond, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {cond.field} {cond.operator} &quot;{cond.value}&quot;
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rule.actions.map((action, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="bg-blue-100 text-blue-700 text-xs"
                          >
                            {action.type.replace("set", "")} → {action.value}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {rule.matchCount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {rule.lastMatched || (
                        <span className="text-zinc-400">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          rule.status === "active" ? "default" : "secondary"
                        }
                        className={
                          rule.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-100 text-zinc-500"
                        }
                      >
                        {rule.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Edit rule
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Duplicate rule
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Delete rule
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Selected Rule Details */}
        {selectedRule && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Rule Details</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const rule = demoRules.find((r) => r.id === selectedRule);
                if (!rule) return null;

                return (
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="mb-2 font-medium">Conditions (IF)</h4>
                      <div className="space-y-2">
                        {rule.conditions.map((cond, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 rounded-lg bg-zinc-50 p-3"
                          >
                            <Badge variant="secondary">{cond.field}</Badge>
                            <span className="text-sm text-zinc-600">
                              {cond.operator}
                            </span>
                            <code className="rounded bg-zinc-200 px-2 py-1 text-sm">
                              {cond.value}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="mb-2 font-medium">Actions (THEN)</h4>
                      <div className="space-y-2">
                        {rule.actions.map((action, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 rounded-lg bg-blue-50 p-3"
                          >
                            <Badge className="bg-blue-100 text-blue-700">
                              {action.type.replace("set", "Set ")}
                            </Badge>
                            <span className="text-sm">→</span>
                            <code className="rounded bg-blue-100 px-2 py-1 text-sm text-blue-800">
                              {action.value}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
