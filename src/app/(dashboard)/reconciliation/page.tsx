'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  GitCompare,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Building2,
  FileText,
  Calendar,
  DollarSign,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import type {
  Account,
  ReconciliationSession,
} from '@/types';

export default function ReconciliationPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [sessions, setSessions] = useState<ReconciliationSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ReconciliationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [view, setView] = useState<'accounts' | 'session'>('accounts');

  // New session form fields
  const [statementEndDate, setStatementEndDate] = useState('');
  const [statementEndingBalance, setStatementEndingBalance] = useState('');
  const [statementBeginningBalance, setStatementBeginningBalance] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadSessions(selectedAccountId);
    }
  }, [selectedAccountId]);

  const loadAccounts = async () => {
    try {
      const data = await api.getAccounts();
      // Filter to bank accounts only
      const bankAccounts = data.filter((acc) => acc.isBankAccount);
      setAccounts(bankAccounts);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async (accountId: string) => {
    try {
      const data = await api.getReconciliationSessions(accountId);
      setSessions(data);
    } catch (error) {
      console.error('Failed to load reconciliation sessions:', error);
    }
  };

  const loadSessionDetails = async (sessionId: string) => {
    try {
      setLoading(true);
      const data = await api.getReconciliationSession(sessionId);
      setSelectedSession(data);
      setView('session');
    } catch (error) {
      console.error('Failed to load session details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = async (accountId: string) => {
    setSelectedAccountId(accountId);
    setView('session');
    setSelectedSession(null);
    await loadSessions(accountId);
  };

  const handleBackToAccounts = () => {
    setView('accounts');
    setSelectedSession(null);
    setSelectedAccountId('');
  };

  const handleCreateSession = async () => {
    if (!selectedAccountId || !statementEndDate || !statementEndingBalance) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setCreating(true);
      await api.createReconciliationSession({
        accountId: selectedAccountId,
        statementEndDate,
        statementEndingBalance,
        statementBeginningBalance: statementBeginningBalance || undefined,
      });

      // Reload sessions
      await loadSessions(selectedAccountId);
      setShowNewSessionForm(false);
      setStatementEndDate('');
      setStatementEndingBalance('');
      setStatementBeginningBalance('');
    } catch (error) {
      console.error('Failed to create reconciliation session:', error);
      alert('Failed to create reconciliation session');
    } finally {
      setCreating(false);
    }
  };

  const handleAutoMatch = async () => {
    if (!selectedSession) return;

    try {
      setLoading(true);
      const result = await api.autoMatchReconciliation(selectedSession.id);
      alert(result.message);
      // Reload session details
      await loadSessionDetails(selectedSession.id);
    } catch (error) {
      console.error('Failed to auto-match:', error);
      alert('Failed to auto-match transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedSession) return;

    if (!selectedSession.summary?.isBalanced) {
      if (!confirm('The reconciliation is not balanced. Are you sure you want to finalize?')) {
        return;
      }
    }

    try {
      setLoading(true);
      await api.finalizeReconciliationSession(selectedSession.id);
      alert('Reconciliation finalized successfully');
      // Reload session details
      await loadSessionDetails(selectedSession.id);
    } catch (error) {
      console.error('Failed to finalize:', error);
      alert('Failed to finalize reconciliation');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getSelectedAccount = () => {
    return accounts.find((acc) => acc.id === selectedAccountId);
  };

  const getAccountLastReconciled = (accountId: string) => {
    const accountSessions = sessions.filter((s) => s.status === 'FINALIZED');
    if (accountSessions.length === 0) return null;
    return accountSessions[0];
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="p-8">
        <Card className="p-12 text-center">
          <GitCompare className="h-12 w-12 mx-auto text-zinc-400 mb-4" />
          <h3 className="text-lg font-medium text-zinc-900 mb-2">No Bank Accounts Found</h3>
          <p className="text-sm text-zinc-600">
            Please set up bank accounts in the Chart of Accounts first.
          </p>
        </Card>
      </div>
    );
  }

  // Bank Account Selection View
  if (view === 'accounts') {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Bank Reconciliation
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Select a bank account to reconcile
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className="p-6 cursor-pointer transition-all hover:shadow-lg hover:border-emerald-300 group"
              onClick={() => handleSelectAccount(account.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                  <Building2 className="h-6 w-6" />
                </div>
                <ArrowRight className="h-5 w-5 text-zinc-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-1">
                {account.title}
              </h3>
              <p className="text-sm text-zinc-500 mb-4">
                Account {account.accountCode}
              </p>
              <div className="pt-4 border-t border-zinc-100">
                <div className="flex items-center text-xs text-zinc-500">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  <span>Click to view reconciliation history</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Session View for Selected Account
  const selectedAccount = getSelectedAccount();

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <button
            onClick={handleBackToAccounts}
            className="text-sm text-zinc-500 hover:text-zinc-700 flex items-center gap-1 mb-2"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Back to Bank Accounts
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            {selectedAccount?.title || 'Bank Reconciliation'}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Account {selectedAccount?.accountCode}
          </p>
        </div>
        <Button
          onClick={() => setShowNewSessionForm(!showNewSessionForm)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Reconciliation
        </Button>
      </div>

      {showNewSessionForm && (
        <Card className="p-6 mb-6 border-emerald-200">
          <h3 className="text-lg font-semibold text-zinc-900 mb-4">
            Create New Reconciliation Session
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Statement End Date *
              </label>
              <Input
                type="date"
                value={statementEndDate}
                onChange={(e) => setStatementEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Statement Ending Balance *
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={statementEndingBalance}
                onChange={(e) => setStatementEndingBalance(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Statement Beginning Balance (Optional)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="Auto-calculated"
                value={statementBeginningBalance}
                onChange={(e) => setStatementBeginningBalance(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleCreateSession}
              disabled={creating || !statementEndDate || !statementEndingBalance}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {creating ? 'Creating...' : 'Create Session'}
            </Button>
            <Button
              onClick={() => setShowNewSessionForm(false)}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Reconciliation History */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">
          Reconciliation History
        </h2>
        {sessions.length === 0 ? (
          <Card className="p-8 text-center">
            <Calendar className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
            <p className="text-sm text-zinc-500">No reconciliations yet</p>
            <p className="text-xs text-zinc-400 mt-1">Create your first reconciliation session to get started</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedSession?.id === session.id ? 'ring-2 ring-emerald-500' : ''
                }`}
                onClick={() => loadSessionDetails(session.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {session.status === 'FINALIZED' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      session.status === 'FINALIZED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {session.status === 'FINALIZED' ? 'Finalized' : 'In Progress'}
                    </span>
                  </div>
                  {session.status === 'FINALIZED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/reconciliation/${session.id}/report`);
                      }}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Report
                    </Button>
                  )}
                </div>
                <div className="mb-2">
                  <div className="text-sm font-medium text-zinc-900">
                    {formatDate(session.statementEndDate)}
                  </div>
                  <div className="text-xs text-zinc-500">Statement Date</div>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <DollarSign className="h-4 w-4 text-zinc-400" />
                  <span className="font-medium">
                    {formatCurrency(session.statementEndingBalance || 0)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Selected Session Details */}
      {selectedSession && (
        <div className="space-y-6">
          <Card className={`p-4 border-l-4 ${
            selectedSession.status === 'FINALIZED'
              ? 'border-l-green-500 bg-green-50'
              : selectedSession.summary?.isBalanced
              ? 'border-l-blue-500 bg-blue-50'
              : 'border-l-yellow-500 bg-yellow-50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedSession.status === 'FINALIZED' ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : selectedSession.summary?.isBalanced ? (
                  <AlertCircle className="h-6 w-6 text-blue-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-yellow-600" />
                )}
                <div>
                  <div className="font-semibold text-sm">
                    {selectedSession.status === 'FINALIZED'
                      ? 'Reconciliation Finalized'
                      : selectedSession.summary?.isBalanced
                      ? 'Reconciliation Balanced - Ready to Finalize'
                      : 'Reconciliation Not Balanced'}
                  </div>
                  <div className="text-xs text-zinc-600">
                    Statement Date: {formatDate(selectedSession.statementEndDate)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {selectedSession.status === 'FINALIZED' ? (
                  <Button
                    onClick={() => router.push(`/reconciliation/${selectedSession.id}/report`)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    size="sm"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Report
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleAutoMatch}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Auto-Match
                    </Button>
                    <Button
                      onClick={handleFinalize}
                      disabled={!selectedSession.summary?.isBalanced}
                      className="bg-emerald-600 hover:bg-emerald-700"
                      size="sm"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Finalize
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          {selectedSession.summary && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">
                Reconciliation Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="font-medium text-zinc-700 border-b pb-2">
                    Bank Statement Reconciliation
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600">Statement Ending Balance:</span>
                    <span className="font-medium">
                      {formatCurrency(selectedSession.summary.bankStatementBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600">
                      (+) Deposits in Transit ({selectedSession.summary.depositsInTransitCount}):
                    </span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(selectedSession.summary.depositsInTransitTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600">
                      (-) Outstanding Checks ({selectedSession.summary.outstandingChecksCount}):
                    </span>
                    <span className="font-medium text-red-600">
                      {formatCurrency(selectedSession.summary.outstandingChecksTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-semibold border-t pt-2">
                    <span>Adjusted Bank Balance:</span>
                    <span className="text-emerald-600">
                      {formatCurrency(selectedSession.summary.adjustedBankBalance)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="font-medium text-zinc-700 border-b pb-2">
                    General Ledger Reconciliation
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600">Book Balance (Cleared Items):</span>
                    <span className="font-medium">
                      {formatCurrency(selectedSession.summary.bookBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-semibold border-t pt-2 mt-auto">
                    <span>Difference:</span>
                    <span className={parseFloat(selectedSession.summary.difference) === 0
                      ? 'text-green-600'
                      : 'text-red-600'
                    }>
                      {formatCurrency(selectedSession.summary.difference)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {selectedSession.matches && selectedSession.matches.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">
                Cleared Transactions ({selectedSession.matches.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-2 font-medium text-zinc-700">Date</th>
                      <th className="pb-2 font-medium text-zinc-700">Description</th>
                      <th className="pb-2 font-medium text-zinc-700 text-right">Amount</th>
                      <th className="pb-2 font-medium text-zinc-700">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedSession.matches.map((match) => (
                      <tr key={match.id}>
                        <td className="py-2 text-zinc-600">
                          {match.sourceTransaction
                            ? formatDate(match.sourceTransaction.date)
                            : match.journalLine
                            ? formatDate(match.journalLine.journalEntry.entryDate)
                            : '-'}
                        </td>
                        <td className="py-2 text-zinc-900">
                          {match.sourceTransaction
                            ? match.sourceTransaction.name
                            : match.journalLine
                            ? match.journalLine.journalEntry.description
                            : '-'}
                        </td>
                        <td className="py-2 text-right font-medium">
                          {match.sourceTransaction
                            ? formatCurrency(match.sourceTransaction.amount)
                            : match.journalLine
                            ? formatCurrency(
                                match.journalLine.debitAmount ||
                                  match.journalLine.creditAmount ||
                                  '0'
                              )
                            : '-'}
                        </td>
                        <td className="py-2 text-xs text-zinc-500">
                          {match.matchType.replace(/_/g, ' ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {selectedSession.outstandingChecks && selectedSession.outstandingChecks.length > 0 && (
            <Card className="p-6 border-l-4 border-l-yellow-500">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">
                Outstanding Checks ({selectedSession.outstandingChecks.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-2 font-medium text-zinc-700">Date</th>
                      <th className="pb-2 font-medium text-zinc-700">Description</th>
                      <th className="pb-2 font-medium text-zinc-700">Memo</th>
                      <th className="pb-2 font-medium text-zinc-700 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedSession.outstandingChecks.map((check) => (
                      <tr key={check.id}>
                        <td className="py-2 text-zinc-600">
                          {formatDate(check.journalEntry.entryDate)}
                        </td>
                        <td className="py-2 text-zinc-900">
                          {check.journalEntry.description}
                        </td>
                        <td className="py-2 text-zinc-600 text-xs">
                          {check.memo || '-'}
                        </td>
                        <td className="py-2 text-right font-medium text-red-600">
                          {formatCurrency(check.debitAmount || check.creditAmount || '0')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {selectedSession.depositsInTransit && selectedSession.depositsInTransit.length > 0 && (
            <Card className="p-6 border-l-4 border-l-blue-500">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">
                Deposits in Transit ({selectedSession.depositsInTransit.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-2 font-medium text-zinc-700">Date</th>
                      <th className="pb-2 font-medium text-zinc-700">Description</th>
                      <th className="pb-2 font-medium text-zinc-700">Merchant</th>
                      <th className="pb-2 font-medium text-zinc-700 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedSession.depositsInTransit.map((deposit) => (
                      <tr key={deposit.id}>
                        <td className="py-2 text-zinc-600">
                          {formatDate(deposit.date)}
                        </td>
                        <td className="py-2 text-zinc-900">{deposit.name}</td>
                        <td className="py-2 text-zinc-600 text-xs">
                          {deposit.merchantName || '-'}
                        </td>
                        <td className="py-2 text-right font-medium text-green-600">
                          {formatCurrency(deposit.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {!selectedSession && sessions.length > 0 && (
        <Card className="p-8 text-center">
          <FileText className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
          <p className="text-sm text-zinc-500">Select a reconciliation session from the history above</p>
        </Card>
      )}
    </div>
  );
}
