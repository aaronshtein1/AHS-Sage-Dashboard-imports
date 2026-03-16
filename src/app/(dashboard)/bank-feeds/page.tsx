'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TransactionList } from '@/components/bank/transaction-list';
import { BankAccountsList } from '@/components/bank/bank-accounts-list';
import { RulesManager } from '@/components/bank/rules-manager';
import { ReconciliationPanel } from '@/components/bank/reconciliation-panel';
import { RuleSuggestions } from '@/components/bank/rule-suggestions';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function BankFeedsPage() {
  const [activeTab, setActiveTab] = useState('transactions');
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState({
    dateColumn: '',
    descriptionColumn: '',
    amountColumn: '',
  });
  const [importing, setImporting] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);

    // Read first line to get headers
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    setCsvHeaders(headers);

    // Auto-detect common column names
    const mapping = {
      dateColumn: headers.find(h => /date/i.test(h)) || headers[0] || '',
      descriptionColumn: headers.find(h => /description|name|merchant/i.test(h)) || headers[1] || '',
      amountColumn: headers.find(h => /amount|value/i.test(h)) || headers[2] || '',
    };
    setColumnMapping(mapping);
  };

  const handleImport = async () => {
    if (!csvFile) return;

    setImporting(true);
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').slice(1); // Skip header

      const transactions = lines
        .filter(line => line.trim())
        .map(line => {
          const values = line.split(',').map(v => v.trim());
          const headers = csvHeaders;
          const row: Record<string, string> = {};
          headers.forEach((header, i) => {
            row[header] = values[i] || '';
          });

          return {
            date: row[columnMapping.dateColumn],
            name: row[columnMapping.descriptionColumn],
            amount: parseFloat(row[columnMapping.amountColumn]),
          };
        });

      await api.importBankTransactions({ transactions });

      setShowImportDialog(false);
      setCsvFile(null);
      setCsvHeaders([]);
      alert(`${transactions.length} transaction${transactions.length === 1 ? '' : 's'} imported successfully`);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please check the file format and try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Bank Feeds</h1>
          <p className="mt-1 text-sm text-zinc-600">Manage bank transactions and matching rules</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'transactions' && (
            <>
              <Button variant="outline" onClick={() => setShowReconciliation(!showReconciliation)}>
                Reconciliation
              </Button>
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                Import
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-zinc-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-3 px-1 text-sm font-medium ${
              activeTab === 'transactions'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`pb-3 px-1 text-sm font-medium ${
              activeTab === 'rules'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Rules
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`pb-3 px-1 text-sm font-medium ${
              activeTab === 'accounts'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Bank Accounts
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`pb-3 px-1 text-sm font-medium flex items-center gap-1.5 ${
              activeTab === 'suggestions'
                ? 'border-b-2 border-amber-500 text-amber-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            AI Suggestions
          </button>
        </div>
      </div>

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <>
          {showReconciliation && (
            <div className="mb-6">
              <ReconciliationPanel />
            </div>
          )}
          <TransactionList />
        </>
      )}

      {/* Matching Rules Tab */}
      {activeTab === 'rules' && <RulesManager />}

      {/* Bank Accounts Tab */}
      {activeTab === 'accounts' && <BankAccountsList />}

      {/* AI Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <div className="bg-gradient-to-br from-amber-50/50 to-white rounded-lg border border-amber-100 p-6">
          <RuleSuggestions />
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Transactions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="mt-1"
              />
            </div>
            {csvHeaders.length > 0 && (
              <>
                <div>
                  <Label>Date Column</Label>
                  <Select
                    value={columnMapping.dateColumn}
                    onValueChange={(value) => setColumnMapping({ ...columnMapping, dateColumn: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select date column" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description Column</Label>
                  <Select
                    value={columnMapping.descriptionColumn}
                    onValueChange={(value) => setColumnMapping({ ...columnMapping, descriptionColumn: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select description column" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Amount Column</Label>
                  <Select
                    value={columnMapping.amountColumn}
                    onValueChange={(value) => setColumnMapping({ ...columnMapping, amountColumn: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select amount column" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!csvFile || importing || !columnMapping.dateColumn || !columnMapping.descriptionColumn || !columnMapping.amountColumn}
              >
                {importing ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
