'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, ChevronRight, RefreshCw } from 'lucide-react';

interface BankAccountOption {
  id: string;
  name: string;
  institutionName: string;
}

export function TransactionList() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [filter, setFilter] = useState('all');
  const [bankAccountFilter, setBankAccountFilter] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  useEffect(() => {
    loadBankAccounts();
  }, []);

  useEffect(() => {
    loadData();
  }, [filter, bankAccountFilter]);

  const loadBankAccounts = async () => {
    try {
      const plaidItems = await api.getPlaidAccounts();
      const options: BankAccountOption[] = [];
      for (const item of plaidItems) {
        for (const account of item.accounts || []) {
          options.push({
            id: account.id,
            name: account.officialName || account.name || 'Unknown Account',
            institutionName: item.plaidInstitutionName || 'Unknown',
          });
        }
      }
      setBankAccounts(options);
    } catch (error) {
      console.error('Failed to load bank accounts:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (filter !== 'all') {
        filters.status = filter;
      }
      if (bankAccountFilter !== 'all') {
        filters.plaidAccountId = bankAccountFilter;
      }

      const [txs, accts] = await Promise.all([
        api.getBankTransactions(Object.keys(filters).length > 0 ? filters : undefined).catch((err) => {
          console.error('Failed to load transactions:', err);
          return [];
        }),
        api.getChartOfAccounts().catch((err) => {
          console.error('Failed to load accounts:', err);
          return [];
        }),
      ]);
      setTransactions(txs);
      setAccounts(accts);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTransactions = async () => {
    setSyncing(true);
    try {
      await api.syncPlaidTransactions();
      await loadData();
    } catch (error) {
      console.error('Failed to sync transactions:', error);
      alert('Failed to sync transactions. Make sure you have connected bank accounts.');
    } finally {
      setSyncing(false);
    }
  };

  const handleMatchBatch = async () => {
    await api.matchTransactionBatch(selected);
    setSelected([]);
    loadData();
  };

  const handlePostBatch = async () => {
    await api.postTransactionBatch(selected);
    setSelected([]);
    loadData();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selected.length === transactions.length) {
      setSelected([]);
    } else {
      setSelected(transactions.map((t) => t.id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters and Batch Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="unmatched">Pending</SelectItem>
              <SelectItem value="matched">Matched</SelectItem>
              <SelectItem value="categorized">Categorized</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
            </SelectContent>
          </Select>

          <Select value={bankAccountFilter} onValueChange={setBankAccountFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All Bank Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bank Accounts</SelectItem>
              {bankAccounts.map((ba) => (
                <SelectItem key={ba.id} value={ba.id}>
                  {ba.institutionName} - {ba.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncTransactions}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Transactions'}
          </Button>
        </div>

        {selected.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-600">
              {selected.length} selected
            </span>
            <Button size="sm" variant="outline" onClick={handleMatchBatch}>
              Match Selected
            </Button>
            <Button
              size="sm"
              onClick={handlePostBatch}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Post Selected
            </Button>
          </div>
        )}
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-lg border border-zinc-200">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="w-12 p-3">
                <Checkbox checked={selected.length === transactions.length && transactions.length > 0} onCheckedChange={toggleSelectAll} />
              </th>
              <th className="text-left p-3 text-sm font-medium text-zinc-700">Date</th>
              <th className="text-left p-3 text-sm font-medium text-zinc-700">Description</th>
              <th className="text-left p-3 text-sm font-medium text-zinc-700">Bank Account</th>
              <th className="text-right p-3 text-sm font-medium text-zinc-700">Amount</th>
              <th className="text-left p-3 text-sm font-medium text-zinc-700">Category</th>
              <th className="text-left p-3 text-sm font-medium text-zinc-700">Status</th>
              <th className="w-12 p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                accounts={accounts}
                isSelected={selected.includes(tx.id)}
                onToggleSelect={toggleSelect}
                onUpdate={loadData}
                onClick={() => setSelectedTransaction(tx)}
              />
            ))}
          </tbody>
        </table>

        {loading && (
          <div className="p-8 text-center text-zinc-500">
            Loading transactions...
          </div>
        )}

        {transactions.length === 0 && !loading && (
          <div className="p-8 text-center text-zinc-500">
            <p>No {filter === 'all' ? '' : filter.toLowerCase()} transactions found.</p>
            <p className="mt-2 text-sm">
              Connect a bank account and click "Sync Transactions" to import transactions from your bank.
            </p>
          </div>
        )}
      </div>

      {/* Transaction Details Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-zinc-700">Date</label>
                  <div className="text-sm text-zinc-900 mt-1">
                    {new Date(selectedTransaction.date).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700">Amount</label>
                  <div className="text-sm text-zinc-900 mt-1">
                    ${Math.abs(selectedTransaction.amount).toFixed(2)}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700">Description</label>
                <div className="text-sm text-zinc-900 mt-1">
                  {selectedTransaction.merchantName || selectedTransaction.name}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700">Select Account</label>
                <Select defaultValue={selectedTransaction.accountId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.accountCode} - {acc.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700">Select Department</label>
                <Select>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administration</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="ops">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700">Notes</label>
                <Textarea
                  name="notes"
                  className="mt-1"
                  placeholder="Add notes..."
                  defaultValue={selectedTransaction.memo}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelectedTransaction(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await api.updateTransaction(selectedTransaction.id, {
                        status: 'MATCHED',
                      });
                      setSelectedTransaction(null);
                      loadData();
                      alert('Transaction matched successfully');
                    } catch (error) {
                      console.error(error);
                    }
                  }}
                >
                  Save Match
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransactionRow({ transaction, accounts, isSelected, onToggleSelect, onUpdate, onClick }: any) {
  const [editing, setEditing] = useState(false);
  const [accountId, setAccountId] = useState(transaction.accountId || '');
  const [memo, setMemo] = useState(transaction.memo || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateTransaction(transaction.id, {
        accountId,
        memo,
        status: 'CATEGORIZED',
      });
      setEditing(false);
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = () => {
    const variants: Record<string, string> = {
      PENDING: 'bg-gray-100 text-gray-800',
      MATCHED: 'bg-blue-100 text-blue-800',
      CATEGORIZED: 'bg-yellow-100 text-yellow-800',
      POSTED: 'bg-green-100 text-green-800',
      EXCLUDED: 'bg-red-100 text-red-800',
    };

    return (
      <div className="flex items-center gap-2">
        <Badge className={variants[transaction.status]} data-status={transaction.status?.toLowerCase()}>
          {transaction.status}
        </Badge>
        {transaction.matchConfidence && (
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              transaction.matchConfidence === 'HIGH'
                ? 'bg-green-50 text-green-700'
                : transaction.matchConfidence === 'MEDIUM'
                ? 'bg-yellow-50 text-yellow-700'
                : 'bg-gray-50 text-gray-700'
            }`}
          >
            {transaction.matchConfidence}
          </span>
        )}
      </div>
    );
  };

  return (
    <tr className="hover:bg-zinc-50 cursor-pointer" onClick={onClick}>
      <td className="p-3" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(transaction.id)}
        />
      </td>
      <td className="p-3 text-sm text-zinc-900">
        {new Date(transaction.date).toLocaleDateString()}
      </td>
      <td className="p-3">
        <div>
          <div className="text-sm font-medium text-zinc-900">
            {transaction.merchantName || transaction.name}
          </div>
          {editing ? (
            <Input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Add memo..."
              className="mt-1 text-xs"
            />
          ) : (
            <div className="text-xs text-zinc-500">
              {memo || transaction.name}
            </div>
          )}
        </div>
      </td>
      <td className="p-3 text-sm text-zinc-600">
        {transaction.plaidAccount?.name}
      </td>
      <td className="p-3 text-sm text-right font-medium">
        <span
          className={
            transaction.amount < 0 ? 'text-green-600' : 'text-red-600'
          }
        >
          {transaction.amount < 0 ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
        </span>
      </td>
      <td className="p-3">
        {editing ? (
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select account..." />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc: any) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.accountCode} - {acc.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="text-sm text-zinc-700">
            {accounts.find((a: any) => a.id === accountId)?.title || '—'}
          </div>
        )}
      </td>
      <td className="p-3">{getStatusBadge()}</td>
      <td className="p-3">
        {editing ? (
          <div className="flex gap-1">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}
