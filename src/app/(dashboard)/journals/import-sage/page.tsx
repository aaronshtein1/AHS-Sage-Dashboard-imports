'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { Account, JournalType } from '@/types';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';

interface ParsedLine {
  lineNo: number;
  memo: string;
  accountNo: string;
  departmentId: string;
  locationId: string;
  debit: number;
  credit: number;
}

interface ParsedJournalEntry {
  journal: string;
  documentNo: string;
  date: string;
  description: string;
  lines: ParsedLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

interface ImportResult {
  success: boolean;
  journalId?: string;
  error?: string;
  entry: ParsedJournalEntry;
}

export default function SageImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parsedEntries, setParsedEntries] = useState<ParsedJournalEntry[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalTypes, setJournalTypes] = useState<JournalType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteFirst, setDeleteFirst] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [accts, types] = await Promise.all([
        api.getAccounts(),
        api.getJournalTypes(),
      ]);
      setAccounts(Array.isArray(accts) ? accts : []);
      setJournalTypes(Array.isArray(types) ? types : []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to parse CSV line handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCSV = useCallback((content: string): ParsedJournalEntry[] => {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and data');
    }

    // Find the header row - it contains "Date,Document,Memo,Account no."
    let headerIndex = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      if (lines[i].toLowerCase().includes('date') && lines[i].toLowerCase().includes('account')) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      throw new Error('Could not find header row with Date and Account columns');
    }

    // Parse header
    const headerLine = lines[headerIndex];
    const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase());

    // Find column indices
    const colIndex = {
      date: headers.findIndex(h => h === 'date'),
      document: headers.findIndex(h => h === 'document'),
      memo: headers.findIndex(h => h === 'memo'),
      accountNo: headers.findIndex(h => h.includes('account') && h.includes('no')),
      accountDesc: headers.findIndex(h => h.includes('account') && h.includes('desc')),
      departmentId: headers.findIndex(h => h.includes('department')),
      locationId: headers.findIndex(h => h.includes('location')),
      debit: headers.findIndex(h => h.includes('dr') || h.includes('debit') || h.includes('increase')),
      credit: headers.findIndex(h => h.includes('cr') || h.includes('credit') || h.includes('decrease')),
    };

    // Get the journal type from lines before header (e.g., "Brex Journal")
    let journalName = 'GJ';
    for (let i = 0; i < headerIndex; i++) {
      const line = lines[i].trim();
      if (line && !line.includes(',') && line.toLowerCase().includes('journal')) {
        journalName = line.replace(/journal/i, '').trim() || 'GJ';
        break;
      }
    }

    // Parse data rows
    const entries: ParsedJournalEntry[] = [];
    let currentEntry: ParsedJournalEntry | null = null;
    let lineNo = 0;

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i];

      // Skip "Total for transaction" rows
      if (line.toLowerCase().includes('total for transaction')) {
        if (currentEntry) {
          currentEntry.totalDebit = currentEntry.lines.reduce((sum, l) => sum + l.debit, 0);
          currentEntry.totalCredit = currentEntry.lines.reduce((sum, l) => sum + l.credit, 0);
          currentEntry.isBalanced = Math.abs(currentEntry.totalDebit - currentEntry.totalCredit) < 0.01;
          entries.push(currentEntry);
          currentEntry = null;
          lineNo = 0;
        }
        continue;
      }

      const values = parseCSVLine(line);
      if (values.length < Math.max(...Object.values(colIndex).filter(v => v >= 0)) + 1) continue;

      const date = colIndex.date >= 0 ? values[colIndex.date] : '';
      const documentNo = colIndex.document >= 0 ? values[colIndex.document] : '';
      const memo = colIndex.memo >= 0 ? values[colIndex.memo] : '';
      const accountNo = colIndex.accountNo >= 0 ? values[colIndex.accountNo] : '';

      // Skip rows without account number (likely headers or separators)
      if (!accountNo) {
        // Check if this is the start of a new transaction (has date and document)
        if (date && documentNo) {
          // Start new entry
          if (currentEntry) {
            currentEntry.totalDebit = currentEntry.lines.reduce((sum, l) => sum + l.debit, 0);
            currentEntry.totalCredit = currentEntry.lines.reduce((sum, l) => sum + l.credit, 0);
            currentEntry.isBalanced = Math.abs(currentEntry.totalDebit - currentEntry.totalCredit) < 0.01;
            entries.push(currentEntry);
          }
          currentEntry = {
            journal: journalName,
            documentNo,
            date,
            description: memo,
            lines: [],
            totalDebit: 0,
            totalCredit: 0,
            isBalanced: false,
          };
          lineNo = 0;
        }
        continue;
      }

      // Parse amounts
      const debitStr = colIndex.debit >= 0 ? values[colIndex.debit]?.replace(/[,$]/g, '') : '';
      const creditStr = colIndex.credit >= 0 ? values[colIndex.credit]?.replace(/[,$]/g, '') : '';
      const debit = parseFloat(debitStr) || 0;
      const credit = parseFloat(creditStr) || 0;

      // Skip lines with zero amounts
      if (debit === 0 && credit === 0) continue;

      // New transaction if we have a date and document number
      if (date && documentNo && (!currentEntry || currentEntry.documentNo !== documentNo)) {
        if (currentEntry) {
          currentEntry.totalDebit = currentEntry.lines.reduce((sum, l) => sum + l.debit, 0);
          currentEntry.totalCredit = currentEntry.lines.reduce((sum, l) => sum + l.credit, 0);
          currentEntry.isBalanced = Math.abs(currentEntry.totalDebit - currentEntry.totalCredit) < 0.01;
          entries.push(currentEntry);
        }
        currentEntry = {
          journal: journalName,
          documentNo,
          date,
          description: memo,
          lines: [],
          totalDebit: 0,
          totalCredit: 0,
          isBalanced: false,
        };
        lineNo = 0;
      }

      if (!currentEntry) {
        currentEntry = {
          journal: journalName,
          documentNo: documentNo || 'N/A',
          date: date || new Date().toLocaleDateString(),
          description: memo,
          lines: [],
          totalDebit: 0,
          totalCredit: 0,
          isBalanced: false,
        };
      }

      lineNo++;
      currentEntry.lines.push({
        lineNo,
        memo: memo || '',
        accountNo,
        departmentId: colIndex.departmentId >= 0 ? values[colIndex.departmentId] || '' : '',
        locationId: colIndex.locationId >= 0 ? values[colIndex.locationId] || '' : '',
        debit,
        credit,
      });
    }

    // Push last entry
    if (currentEntry && currentEntry.lines.length > 0) {
      currentEntry.totalDebit = currentEntry.lines.reduce((sum, l) => sum + l.debit, 0);
      currentEntry.totalCredit = currentEntry.lines.reduce((sum, l) => sum + l.credit, 0);
      currentEntry.isBalanced = Math.abs(currentEntry.totalDebit - currentEntry.totalCredit) < 0.01;
      entries.push(currentEntry);
    }

    return entries;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseError(null);
    setParsedEntries([]);
    setImportResults([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const entries = parseCSV(content);
        setParsedEntries(entries);
        // Expand first few entries by default
        setExpandedEntries(new Set([0, 1, 2]));
      } catch (error) {
        setParseError(error instanceof Error ? error.message : 'Failed to parse CSV file');
      }
    };
    reader.onerror = () => setParseError('Failed to read file');
    reader.readAsText(selectedFile);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      const input = document.getElementById('file-input') as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(droppedFile);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, []);

  const toggleEntry = (index: number) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedEntries(newExpanded);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    // Convert MM/DD/YYYY to YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateStr;
  };

  const handleImport = async () => {
    if (parsedEntries.length === 0) return;

    setIsImporting(true);
    const results: ImportResult[] = [];

    // Delete existing entries if checkbox is checked
    if (deleteFirst) {
      setIsDeleting(true);
      try {
        const deleteResult = await api.deleteAllDraftJournals();
        console.log('Deleted existing entries:', deleteResult);
      } catch (error) {
        console.error('Failed to delete existing entries:', error);
      }
      setIsDeleting(false);
    }

    // Find or create journal type
    const journalCodes = new Set(parsedEntries.map(e => e.journal));
    const journalTypeMap = new Map<string, JournalType>();

    for (const code of journalCodes) {
      let journalType = journalTypes.find(jt => jt.code.toUpperCase() === code.toUpperCase());
      if (!journalType) {
        try {
          journalType = await api.createJournalType({
            code: code.toUpperCase(),
            name: `${code} Journal`,
            description: `Imported journal type for ${code}`,
          });
          setJournalTypes(prev => [...prev, journalType!]);
        } catch (error) {
          console.error('Failed to create journal type:', error);
          // Try to find it again (might have been created by another import)
          journalType = journalTypes.find(jt => jt.code.toUpperCase() === code.toUpperCase());
        }
      }
      if (journalType) {
        journalTypeMap.set(code, journalType);
      }
    }

    for (const entry of parsedEntries) {
      if (!entry.isBalanced) {
        results.push({
          success: false,
          error: `Journal entry is not balanced (off by ${formatCurrency(Math.abs(entry.totalDebit - entry.totalCredit))})`,
          entry,
        });
        continue;
      }

      try {
        // Map account numbers to account IDs
        const lines = entry.lines
          .filter(line => line.debit > 0 || line.credit > 0)
          .map(line => {
            const account = accounts.find(a => a.accountCode === line.accountNo);
            if (!account) {
              throw new Error(`Account not found: ${line.accountNo}`);
            }
            return {
              accountId: account.id,
              debit: line.debit,
              credit: line.credit,
              description: line.memo || undefined,
            };
          });

        const journalType = journalTypeMap.get(entry.journal);
        if (!journalType) {
          throw new Error(`Journal type not found: ${entry.journal}`);
        }

        const journal = await api.createJournal({
          journalTypeId: journalType.id,
          entryDate: formatDate(entry.date),
          referenceNumber: `${entry.journal}-${entry.documentNo}`,
          description: entry.description || `Document ${entry.documentNo}`,
          lines,
        });

        results.push({
          success: true,
          journalId: journal.id,
          entry,
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create journal entry',
          entry,
        });
      }
    }

    setImportResults(results);
    setIsImporting(false);
  };

  const successCount = importResults.filter(r => r.success).length;
  const failureCount = importResults.filter(r => !r.success).length;

  if (isLoading) {
    return (
      <div className="p-6 bg-zinc-50 min-h-screen">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600"></div>
            <p className="text-sm text-zinc-500">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-zinc-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/journals" className="p-2 hover:bg-zinc-200 rounded transition-colors">
          <ArrowLeft className="h-5 w-5 text-zinc-600" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Import Sage Intacct Journal Report</h1>
          <p className="text-sm text-zinc-500">Upload a Journal Report CSV export from Sage Intacct</p>
        </div>
      </div>

      {/* Upload Area */}
      {!file && (
        <Card
          className="p-8 border-2 border-dashed border-zinc-300 bg-white hover:border-zinc-400 transition-colors cursor-pointer"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-zinc-100 rounded-full">
              <Upload className="h-8 w-8 text-zinc-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-900">
                Drop your Sage Intacct Journal Report CSV here or click to browse
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Supports format: Date, Document, Memo, Account no., Account desc, Department ID, Location ID, Dr/increase, Cr/decrease
              </p>
            </div>
            <input
              id="file-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </Card>
      )}

      {/* File Selected */}
      {file && !importResults.length && (
        <Card className="p-4 bg-white border-zinc-200 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-100 rounded">
                <FileText className="h-5 w-5 text-zinc-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">{file.name}</p>
                <p className="text-xs text-zinc-500">
                  {parsedEntries.length} journal {parsedEntries.length === 1 ? 'entry' : 'entries'} found
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFile(null);
                setParsedEntries([]);
                setParseError(null);
              }}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Parse Error */}
      {parseError && (
        <Card className="p-4 bg-red-50 border-red-200 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">{parseError}</p>
          </div>
        </Card>
      )}

      {/* Preview */}
      {parsedEntries.length > 0 && !importResults.length && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-900 uppercase tracking-wide">Preview</h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={deleteFirst}
                  onChange={(e) => setDeleteFirst(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                <Trash2 className="h-4 w-4 text-red-500" />
                Delete existing draft entries first
              </label>
              <Button
                onClick={handleImport}
                disabled={isImporting || parsedEntries.some(e => !e.isBalanced)}
                className="bg-zinc-900 hover:bg-zinc-800 text-white"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isDeleting ? 'Deleting...' : 'Importing...'}
                  </>
                ) : (
                  <>Import {parsedEntries.length} {parsedEntries.length === 1 ? 'Entry' : 'Entries'}</>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {parsedEntries.map((entry, index) => (
              <Card key={index} className="bg-white border-zinc-200 overflow-hidden">
                <button
                  className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors"
                  onClick={() => toggleEntry(index)}
                >
                  <div className="flex items-center gap-4">
                    {expandedEntries.has(index) ? (
                      <ChevronDown className="h-4 w-4 text-zinc-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-zinc-400" />
                    )}
                    <div className="text-left">
                      <p className="text-sm font-medium text-zinc-900">
                        {entry.description || `Document ${entry.documentNo}`}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {entry.date} &middot; Doc #{entry.documentNo} &middot; {entry.lines.length} lines &middot; {entry.journal}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-zinc-900 tabular-nums">
                        {formatCurrency(entry.totalDebit)}
                      </p>
                    </div>
                    {entry.isBalanced ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </button>

                {expandedEntries.has(index) && (
                  <div className="border-t border-zinc-100">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50">
                        <tr>
                          <th className="text-left py-2 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wide">Line</th>
                          <th className="text-left py-2 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wide">Account</th>
                          <th className="text-left py-2 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wide">Memo</th>
                          <th className="text-left py-2 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wide">Location</th>
                          <th className="text-right py-2 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wide">Debit</th>
                          <th className="text-right py-2 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wide">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.lines.map((line, lineIndex) => {
                          const account = accounts.find(a => a.accountCode === line.accountNo);
                          return (
                            <tr key={lineIndex} className="border-t border-zinc-100">
                              <td className="py-2 px-4 text-zinc-600 tabular-nums">{line.lineNo}</td>
                              <td className="py-2 px-4">
                                <span className={account ? 'text-zinc-900' : 'text-red-600'}>
                                  {line.accountNo}
                                </span>
                                {account && (
                                  <span className="text-zinc-500 ml-2">{account.title}</span>
                                )}
                                {!account && (
                                  <span className="text-red-500 text-xs ml-2">Not found</span>
                                )}
                              </td>
                              <td className="py-2 px-4 text-zinc-600 truncate max-w-[200px]">{line.memo}</td>
                              <td className="py-2 px-4 text-zinc-600">{line.locationId}</td>
                              <td className="py-2 px-4 text-right tabular-nums text-zinc-900">
                                {line.debit > 0 ? formatCurrency(line.debit) : ''}
                              </td>
                              <td className="py-2 px-4 text-right tabular-nums text-zinc-900">
                                {line.credit > 0 ? formatCurrency(line.credit) : ''}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-medium">
                          <td colSpan={4} className="py-2 px-4 text-zinc-700">Total</td>
                          <td className="py-2 px-4 text-right tabular-nums text-zinc-900">
                            {formatCurrency(entry.totalDebit)}
                          </td>
                          <td className="py-2 px-4 text-right tabular-nums text-zinc-900">
                            {formatCurrency(entry.totalCredit)}
                          </td>
                        </tr>
                        {!entry.isBalanced && (
                          <tr className="bg-red-50">
                            <td colSpan={4} className="py-2 px-4 text-red-600 text-xs">
                              Out of balance by {formatCurrency(Math.abs(entry.totalDebit - entry.totalCredit))}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Import Results */}
      {importResults.length > 0 && (
        <>
          <Card className={`p-4 mb-6 ${failureCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-3">
              {failureCount === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              )}
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  Import Complete
                </p>
                <p className="text-xs text-zinc-600">
                  {successCount} successful, {failureCount} failed
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {importResults.map((result, index) => (
              <Card
                key={index}
                className={`p-4 ${result.success ? 'bg-white border-zinc-200' : 'bg-red-50 border-red-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {result.entry.description || `Document ${result.entry.documentNo}`}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {result.entry.date} &middot; {formatCurrency(result.entry.totalDebit)}
                      </p>
                    </div>
                  </div>
                  {result.success ? (
                    <span className="text-xs text-green-600">Created</span>
                  ) : (
                    <span className="text-xs text-red-600">{result.error}</span>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setFile(null);
                setParsedEntries([]);
                setImportResults([]);
                setParseError(null);
              }}
            >
              Import Another File
            </Button>
            <Link href="/journals">
              <Button className="bg-zinc-900 hover:bg-zinc-800 text-white">
                View Journals
              </Button>
            </Link>
          </div>
        </>
      )}

      {/* Format Info */}
      {!file && (
        <Card className="mt-6 p-5 bg-white border-zinc-200">
          <h3 className="text-sm font-medium text-zinc-900 mb-3">Expected CSV Format</h3>
          <div className="text-xs text-zinc-600 space-y-2">
            <p>This importer supports the Sage Intacct Journal Report export format:</p>
            <div className="bg-zinc-50 p-3 rounded font-mono text-[10px] overflow-x-auto">
              Date, Document, Memo, Account no., Account desc, Department ID, Location ID, Dr/increase, Cr/decrease
            </div>
            <ul className="list-disc list-inside space-y-1 mt-3">
              <li><strong>Date</strong> - Entry date in MM/DD/YYYY format</li>
              <li><strong>Document</strong> - Transaction/document number (groups lines into entries)</li>
              <li><strong>Memo</strong> - Line description</li>
              <li><strong>Account no.</strong> - GL account number</li>
              <li><strong>Dr/increase</strong> / <strong>Cr/decrease</strong> - Debit and credit amounts</li>
            </ul>
            <p className="mt-3 text-amber-600">
              Note: The importer will automatically detect the journal type from the header rows (e.g., &quot;Brex Journal&quot;)
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
