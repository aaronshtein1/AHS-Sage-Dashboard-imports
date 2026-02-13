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
import { RuleBuilder } from "@/components/credit-cards/rule-builder";
import { formatCurrency, cn } from "@/lib/utils";
import {
  CreditCard,
  AlertCircle,
  CheckCircle,
  Wand2,
  RefreshCw,
  LogIn,
  Loader2,
  Search,
  Filter,
  Eye,
  Plus,
} from "lucide-react";

// Demo unreconciled transactions
const demoTransactions = [
  {
    id: "txn1",
    date: "2025-01-20",
    description: "AMAZON WEB SERVICES AWS.AMAZON.CO",
    amount: -1542.87,
    cardLast4: "4521",
    cardHolder: "John Smith",
    status: "unreconciled",
    suggestedVendor: "Amazon Web Services",
    suggestedGL: "6200 - Cloud Services",
  },
  {
    id: "txn2",
    date: "2025-01-19",
    description: "UBER TRIP HELP.UBER.COM",
    amount: -34.52,
    cardLast4: "4521",
    cardHolder: "John Smith",
    status: "unreconciled",
    suggestedVendor: "Uber",
    suggestedGL: "6500 - Travel & Entertainment",
  },
  {
    id: "txn3",
    date: "2025-01-18",
    description: "STAPLES STORE #1234 NEW YORK NY",
    amount: -89.99,
    cardLast4: "7832",
    cardHolder: "Jane Doe",
    status: "unreconciled",
    suggestedVendor: "Staples",
    suggestedGL: "6100 - Office Supplies",
  },
  {
    id: "txn4",
    date: "2025-01-18",
    description: "ZOOM.US 888-799-9666",
    amount: -149.90,
    cardLast4: "4521",
    cardHolder: "John Smith",
    status: "unreconciled",
    suggestedVendor: "Zoom",
    suggestedGL: "6200 - Software Subscriptions",
  },
  {
    id: "txn5",
    date: "2025-01-17",
    description: "DELTA AIR LINES 0062398765432",
    amount: -487.00,
    cardLast4: "7832",
    cardHolder: "Jane Doe",
    status: "unreconciled",
    suggestedVendor: "Delta Airlines",
    suggestedGL: "6500 - Travel & Entertainment",
  },
  {
    id: "txn6",
    date: "2025-01-16",
    description: "MICROSOFT*AZURE MSBILL.INFO WA",
    amount: -892.34,
    cardLast4: "4521",
    cardHolder: "John Smith",
    status: "unreconciled",
    suggestedVendor: "Microsoft Azure",
    suggestedGL: "6200 - Cloud Services",
  },
  {
    id: "txn7",
    date: "2025-01-15",
    description: "DOORDASH*CHIPOTLE 855-973-1040 CA",
    amount: -28.45,
    cardLast4: "7832",
    cardHolder: "Jane Doe",
    status: "unreconciled",
    suggestedVendor: "DoorDash",
    suggestedGL: "6400 - Meals & Entertainment",
  },
];

// Demo GL accounts
const demoGLAccounts = [
  { id: "6100", number: "6100", name: "Office Supplies" },
  { id: "6200", number: "6200", name: "Software & Cloud Services" },
  { id: "6300", number: "6300", name: "Professional Services" },
  { id: "6400", number: "6400", name: "Meals & Entertainment" },
  { id: "6500", number: "6500", name: "Travel & Transportation" },
  { id: "6600", number: "6600", name: "Utilities" },
  { id: "6700", number: "6700", name: "Marketing & Advertising" },
];

// Demo departments
const demoDepartments = [
  { id: "admin", name: "Administration" },
  { id: "sales", name: "Sales" },
  { id: "engineering", name: "Engineering" },
  { id: "marketing", name: "Marketing" },
  { id: "clinical", name: "Clinical Operations" },
];

// Demo locations
const demoLocations = [
  { id: "hq", name: "Headquarters" },
  { id: "downtown", name: "Downtown Clinic" },
  { id: "westside", name: "Westside Office" },
  { id: "north", name: "North Campus" },
];

// Demo vendors
const demoVendors = [
  { id: "aws", name: "Amazon Web Services" },
  { id: "uber", name: "Uber Technologies" },
  { id: "staples", name: "Staples Inc." },
  { id: "zoom", name: "Zoom Video Communications" },
  { id: "delta", name: "Delta Air Lines" },
  { id: "msft", name: "Microsoft Corporation" },
  { id: "doordash", name: "DoorDash Inc." },
];

export default function CreditCardsPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<typeof demoTransactions[0] | null>(null);
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);

  // Filter transactions
  const filteredTransactions = demoTransactions.filter(
    (txn) =>
      txn.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.cardHolder.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Login to Intacct via MCP
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const response = await fetch("/api/mcp/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: process.env.NEXT_PUBLIC_INTACCT_COMPANY_ID || "",
          userId: process.env.NEXT_PUBLIC_INTACCT_USER_ID || "",
          password: "", // Will prompt user
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsLoggedIn(true);
        if (data.screenshot) {
          setScreenshot(data.screenshot);
        }
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch (error) {
      setLoginError("Failed to connect to MCP server. Make sure Chrome MCP is running.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Create rule via MCP
  const handleCreateRule = async (rule: {
    name: string;
    description?: string;
    priority: number;
    conditions: Array<{ field: string; operator: string; value: string }>;
    actions: Array<{ type: string; value: string }>;
  }) => {
    const response = await fetch("/api/mcp/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to create rule");
    }

    const data = await response.json();
    if (data.screenshot) {
      setScreenshot(data.screenshot);
    }
  };

  // Open rule builder for a transaction
  const openRuleBuilder = (transaction: typeof demoTransactions[0]) => {
    setSelectedTransaction(transaction);
    setShowRuleBuilder(true);
  };

  return (
    <div className="flex flex-col">
      <Header
        title="Credit Card Reconciliation"
        subtitle="Review unreconciled transactions and create matching rules"
      >
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <Badge variant="default" className="bg-emerald-500">
              <CheckCircle className="mr-1 h-3 w-3" />
              Connected to Intacct
            </Badge>
          ) : (
            <Button size="sm" onClick={handleLogin} disabled={isLoggingIn}>
              {isLoggingIn ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Connect to Intacct
            </Button>
          )}
        </div>
      </Header>

      <div className="p-6">
        {/* Login Error */}
        {loginError && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-900">Connection Error</p>
                <p className="text-sm text-red-700">{loginError}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* MCP Connection Instructions */}
        {!isLoggedIn && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <CreditCard className="mt-0.5 h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-blue-900">
                    Chrome MCP Required
                  </p>
                  <p className="mt-1 text-sm text-blue-700">
                    To automatically create rules in Sage Intacct, you need to:
                  </p>
                  <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-blue-700">
                    <li>
                      Start the Chrome MCP server:{" "}
                      <code className="rounded bg-blue-100 px-1">
                        npx @anthropic-ai/mcp-chrome
                      </code>
                    </li>
                    <li>Click &quot;Connect to Intacct&quot; above to login via browser automation</li>
                    <li>Select transactions and create matching rules</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rule Builder Modal */}
        {showRuleBuilder && selectedTransaction && (
          <div className="mb-6">
            <RuleBuilder
              initialDescription={selectedTransaction.description}
              initialAmount={selectedTransaction.amount}
              onCreateRule={handleCreateRule}
              onCancel={() => {
                setShowRuleBuilder(false);
                setSelectedTransaction(null);
              }}
              glAccounts={demoGLAccounts}
              departments={demoDepartments}
              locations={demoLocations}
              vendors={demoVendors}
            />
          </div>
        )}

        {/* Screenshot Preview */}
        {screenshot && (
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Intacct Browser View
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScreenshot(null)}
              >
                Close
              </Button>
            </CardHeader>
            <CardContent>
              <img
                src={`data:image/png;base64,${screenshot}`}
                alt="Intacct browser screenshot"
                className="w-full rounded-lg border"
              />
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-lg bg-amber-100 p-3">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{demoTransactions.length}</p>
                <p className="text-sm text-zinc-500">Unreconciled</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-lg bg-blue-100 p-3">
                <CreditCard className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    Math.abs(
                      demoTransactions.reduce((s, t) => s + t.amount, 0)
                    )
                  )}
                </p>
                <p className="text-sm text-zinc-500">Total Amount</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-lg bg-purple-100 p-3">
                <Wand2 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">12</p>
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
                <p className="text-2xl font-bold">94%</p>
                <p className="text-sm text-zinc-500">Auto-Match Rate</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Unreconciled Transactions
                </CardTitle>
                <CardDescription>
                  Select a transaction to create a matching rule
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64 pl-9"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
                <Button variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Card</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Suggested Mapping</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((txn) => (
                  <TableRow
                    key={txn.id}
                    className={cn(
                      "cursor-pointer",
                      selectedTransaction?.id === txn.id && "bg-blue-50"
                    )}
                    onClick={() => setSelectedTransaction(txn)}
                  >
                    <TableCell className="whitespace-nowrap">
                      {txn.date}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{txn.description}</p>
                        <p className="text-sm text-zinc-500">{txn.cardHolder}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">****{txn.cardLast4}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span
                        className={
                          txn.amount < 0 ? "text-red-600" : "text-emerald-600"
                        }
                      >
                        {formatCurrency(txn.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="text-zinc-600">{txn.suggestedVendor}</p>
                        <p className="text-zinc-400">{txn.suggestedGL}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                        Unreconciled
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRuleBuilder(txn);
                        }}
                        disabled={!isLoggedIn}
                        title={
                          isLoggedIn
                            ? "Create matching rule"
                            : "Connect to Intacct first"
                        }
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Create Rule
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
