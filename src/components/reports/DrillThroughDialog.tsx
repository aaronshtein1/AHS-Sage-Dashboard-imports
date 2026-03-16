'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { DrillThroughTransaction, PaginatedResponse } from '@/types';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink } from 'lucide-react';

interface DrillThroughDialogProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  accountTitle?: string;
  startDate: string;
  endDate: string;
}

const formatCurrency = (value: number): string => {
  if (value === 0) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

export function DrillThroughDialog({
  open,
  onClose,
  accountId,
  accountTitle,
  startDate,
  endDate,
}: DrillThroughDialogProps) {
  const router = useRouter();
  const [transactions, setTransactions] = useState<DrillThroughTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && accountId) {
      loadTransactions();
    }
  }, [open, accountId, startDate, endDate]);

  const loadTransactions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.getReportDrillThrough({
        accountId,
        startDate,
        endDate,
      });
      setTransactions(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJournalClick = (journalEntryId: string) => {
    router.push(`/journals/${journalEntryId}`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Transaction Detail</DialogTitle>
          {accountTitle && (
            <p className="text-sm text-zinc-500 mt-1">
              {accountTitle} ({startDate} to {endDate})
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadTransactions}
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              No transactions found for this period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead className="w-28">Journal #</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right w-28">Debit</TableHead>
                  <TableHead className="text-right w-28">Credit</TableHead>
                  <TableHead className="text-right w-32">Balance</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => (
                  <TableRow
                    key={txn.id}
                    className="cursor-pointer hover:bg-zinc-50"
                    onClick={() => handleJournalClick(txn.journalEntryId)}
                  >
                    <TableCell className="font-mono text-sm">
                      {txn.date}
                    </TableCell>
                    <TableCell className="font-medium text-emerald-600">
                      {txn.journalNumber}
                    </TableCell>
                    <TableCell>{txn.description}</TableCell>
                    <TableCell className="text-zinc-500">
                      {txn.reference || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(txn.debit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(txn.credit)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {txn.runningBalance !== undefined
                        ? formatCurrency(txn.runningBalance)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <ExternalLink className="h-4 w-4 text-zinc-400" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {transactions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-6 font-mono">
                <span>
                  Debits:{' '}
                  <strong className="text-emerald-600">
                    {formatCurrency(
                      transactions.reduce((sum, t) => sum + t.debit, 0)
                    )}
                  </strong>
                </span>
                <span>
                  Credits:{' '}
                  <strong className="text-emerald-600">
                    {formatCurrency(
                      transactions.reduce((sum, t) => sum + t.credit, 0)
                    )}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
