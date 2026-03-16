'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Printer,
  Download,
  CheckCircle2,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { ReconciliationSession, Account } from '@/types';

export default function ReconciliationReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [session, setSession] = useState<ReconciliationSession | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessionDetails();
  }, [resolvedParams.sessionId]);

  const loadSessionDetails = async () => {
    try {
      setLoading(true);
      const data = await api.getReconciliationSession(resolvedParams.sessionId);
      setSession(data);

      // Load the account details
      if (data.accountId) {
        const accounts = await api.getAccounts();
        const acc = accounts.find((a) => a.id === data.accountId);
        if (acc) setAccount(acc);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
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
      month: 'long',
      day: 'numeric',
    });
  };

  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8">
        <Card className="p-12 text-center">
          <h3 className="text-lg font-medium text-zinc-900 mb-2">
            Reconciliation Session Not Found
          </h3>
          <Button onClick={() => router.push('/reconciliation')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reconciliation
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 print:p-4">
      {/* Header with Actions - Hidden on Print */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Button onClick={() => router.push('/reconciliation')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Reconciliation
        </Button>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Report Content */}
      <div className="max-w-4xl mx-auto bg-white print:shadow-none">
        {/* Report Header */}
        <div className="text-center mb-8 pb-6 border-b-2 border-zinc-200">
          <h1 className="text-2xl font-bold text-zinc-900 mb-1">
            Bank Reconciliation Report
          </h1>
          <div className="flex items-center justify-center gap-2 text-zinc-600 mb-2">
            <Building2 className="h-4 w-4" />
            <span className="font-medium">{account?.title || 'Bank Account'}</span>
            <span className="text-zinc-400">|</span>
            <span>Account {account?.accountCode}</span>
          </div>
          <p className="text-zinc-500">
            Statement Period Ending: {formatDate(session.statementEndDate)}
          </p>
          {session.status === 'FINALIZED' && session.finalizedAt && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Finalized on {formatDate(session.finalizedAt)}
            </div>
          )}
        </div>

        {/* Reconciliation Summary */}
        {session.summary && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4 border-b pb-2">
              Reconciliation Summary
            </h2>
            <div className="grid grid-cols-2 gap-8">
              {/* Bank Side */}
              <div>
                <h3 className="font-medium text-zinc-700 mb-3">
                  Bank Statement Balance
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-1.5 text-zinc-600">
                        Statement Ending Balance:
                      </td>
                      <td className="py-1.5 text-right font-medium">
                        {formatCurrency(session.summary.bankStatementBalance)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-zinc-600">
                        Add: Deposits in Transit ({session.summary.depositsInTransitCount})
                      </td>
                      <td className="py-1.5 text-right font-medium text-green-600">
                        {formatCurrency(session.summary.depositsInTransitTotal)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-zinc-600">
                        Less: Outstanding Checks ({session.summary.outstandingChecksCount})
                      </td>
                      <td className="py-1.5 text-right font-medium text-red-600">
                        ({formatCurrency(session.summary.outstandingChecksTotal)})
                      </td>
                    </tr>
                    <tr className="border-t-2 border-zinc-300">
                      <td className="py-2 font-semibold">Adjusted Bank Balance:</td>
                      <td className="py-2 text-right font-bold text-lg">
                        {formatCurrency(session.summary.adjustedBankBalance)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Book Side */}
              <div>
                <h3 className="font-medium text-zinc-700 mb-3">
                  General Ledger Balance
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-1.5 text-zinc-600">Book Balance:</td>
                      <td className="py-1.5 text-right font-medium">
                        {formatCurrency(session.summary.bookBalance)}
                      </td>
                    </tr>
                    <tr className="border-t-2 border-zinc-300">
                      <td className="py-2 font-semibold">Adjusted Book Balance:</td>
                      <td className="py-2 text-right font-bold text-lg">
                        {formatCurrency(session.summary.bookBalance)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Difference */}
            <div className={`mt-6 p-4 rounded-lg text-center ${
              parseFloat(session.summary.difference) === 0
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <span className="text-sm font-medium text-zinc-700">Difference: </span>
              <span className={`text-lg font-bold ${
                parseFloat(session.summary.difference) === 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {formatCurrency(session.summary.difference)}
              </span>
              {parseFloat(session.summary.difference) === 0 && (
                <span className="ml-2 text-green-600 text-sm">
                  (Balanced)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Outstanding Checks */}
        {session.outstandingChecks && session.outstandingChecks.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4 border-b pb-2">
              Outstanding Checks
            </h2>
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="py-2 px-3 text-left font-medium text-zinc-700">Date</th>
                  <th className="py-2 px-3 text-left font-medium text-zinc-700">Description</th>
                  <th className="py-2 px-3 text-left font-medium text-zinc-700">Memo</th>
                  <th className="py-2 px-3 text-right font-medium text-zinc-700">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {session.outstandingChecks.map((check) => (
                  <tr key={check.id}>
                    <td className="py-2 px-3 text-zinc-600">
                      {formatShortDate(check.journalEntry.entryDate)}
                    </td>
                    <td className="py-2 px-3 text-zinc-900">
                      {check.journalEntry.description}
                    </td>
                    <td className="py-2 px-3 text-zinc-500 text-xs">
                      {check.memo || '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-red-600">
                      {formatCurrency(check.debitAmount || check.creditAmount || '0')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-50 font-semibold">
                <tr>
                  <td colSpan={3} className="py-2 px-3 text-right">
                    Total Outstanding Checks:
                  </td>
                  <td className="py-2 px-3 text-right text-red-600">
                    {formatCurrency(session.summary?.outstandingChecksTotal || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Deposits in Transit */}
        {session.depositsInTransit && session.depositsInTransit.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4 border-b pb-2">
              Deposits in Transit
            </h2>
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="py-2 px-3 text-left font-medium text-zinc-700">Date</th>
                  <th className="py-2 px-3 text-left font-medium text-zinc-700">Description</th>
                  <th className="py-2 px-3 text-left font-medium text-zinc-700">Source</th>
                  <th className="py-2 px-3 text-right font-medium text-zinc-700">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {session.depositsInTransit.map((deposit) => (
                  <tr key={deposit.id}>
                    <td className="py-2 px-3 text-zinc-600">
                      {formatShortDate(deposit.date)}
                    </td>
                    <td className="py-2 px-3 text-zinc-900">{deposit.name}</td>
                    <td className="py-2 px-3 text-zinc-500 text-xs">
                      {deposit.merchantName || '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-green-600">
                      {formatCurrency(deposit.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-50 font-semibold">
                <tr>
                  <td colSpan={3} className="py-2 px-3 text-right">
                    Total Deposits in Transit:
                  </td>
                  <td className="py-2 px-3 text-right text-green-600">
                    {formatCurrency(session.summary?.depositsInTransitTotal || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Cleared Transactions */}
        {session.matches && session.matches.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4 border-b pb-2">
              Cleared Transactions ({session.matches.length})
            </h2>
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="py-2 px-3 text-left font-medium text-zinc-700">Date</th>
                  <th className="py-2 px-3 text-left font-medium text-zinc-700">Description</th>
                  <th className="py-2 px-3 text-left font-medium text-zinc-700">Match Type</th>
                  <th className="py-2 px-3 text-right font-medium text-zinc-700">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {session.matches.map((match) => (
                  <tr key={match.id}>
                    <td className="py-2 px-3 text-zinc-600">
                      {match.sourceTransaction
                        ? formatShortDate(match.sourceTransaction.date)
                        : match.journalLine
                        ? formatShortDate(match.journalLine.journalEntry.entryDate)
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-zinc-900">
                      {match.sourceTransaction
                        ? match.sourceTransaction.name
                        : match.journalLine
                        ? match.journalLine.journalEntry.description
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-zinc-500 text-xs">
                      {match.matchType.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2 px-3 text-right font-medium">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer - Signature Lines */}
        <div className="mt-12 pt-8 border-t-2 border-zinc-200 print:mt-8">
          <div className="grid grid-cols-2 gap-16">
            <div>
              <div className="border-b border-zinc-400 mb-2 h-8"></div>
              <p className="text-sm text-zinc-600">Prepared By</p>
              <p className="text-xs text-zinc-400 mt-1">Date: ________________</p>
            </div>
            <div>
              <div className="border-b border-zinc-400 mb-2 h-8"></div>
              <p className="text-sm text-zinc-600">Approved By</p>
              <p className="text-xs text-zinc-400 mt-1">Date: ________________</p>
            </div>
          </div>
          <p className="text-center text-xs text-zinc-400 mt-8">
            Generated on {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
