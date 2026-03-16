'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { JournalEntry, JournalType, Account } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  ArrowLeft,
  Search,
  FileText,
  Calendar,
  CheckCheck,
  Loader2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Undo2,
} from 'lucide-react';

export default function JournalEntriesPage() {
  const params = useParams();
  const journalTypeId = params.typeId as string;

  const [journalType, setJournalType] = useState<JournalType | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPostingAll, setIsPostingAll] = useState(false);

  // Multi-select state
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [isPostingSelected, setIsPostingSelected] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [isUnpostingSelected, setIsUnpostingSelected] = useState(false);
  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const [allEntryIds, setAllEntryIds] = useState<string[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [pageSize] = useState(50);

  // Form data
  const [formData, setFormData] = useState({
    entryDate: new Date().toISOString().split('T')[0],
    referenceNumber: '',
    description: '',
    lines: [
      { accountId: '', description: '', debit: 0, credit: 0 },
      { accountId: '', description: '', debit: 0, credit: 0 },
    ],
  });

  useEffect(() => {
    loadJournalType();
    loadAccounts();
  }, [journalTypeId]);

  useEffect(() => {
    if (journalType) {
      loadEntries();
    }
  }, [journalType, statusFilter, startDate, endDate, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, startDate, endDate]);

  const loadJournalType = async () => {
    try {
      const types = await api.getJournalTypes();
      const type = types.find((t) => t.id === journalTypeId);
      setJournalType(type || null);
    } catch (error) {
      console.error('Failed to load journal type:', error);
    }
  };

  const loadAccounts = async () => {
    try {
      const result = await api.getAccounts();
      setAccounts(result || []);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      const filters: any = { journalTypeId, page: currentPage, pageSize };
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const result = await api.getJournals(filters);
      setEntries(Array.isArray(result?.data) ? result.data : []);
      setTotalPages(result?.totalPages || 1);
      setTotalEntries(result?.total || 0);
    } catch (error) {
      console.error('Failed to load entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.description?.toLowerCase().includes(query) ||
      entry.referenceNumber?.toLowerCase().includes(query)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate balance
    const totalDebit = formData.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = formData.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      alert('Journal entry must be balanced. Debits must equal credits.');
      return;
    }

    try {
      const payload = {
        ...formData,
        journalTypeId,
        lines: formData.lines.filter((l) => l.accountId && (l.debit > 0 || l.credit > 0)),
      };

      if (editingEntry) {
        await api.updateJournal(editingEntry.id, payload);
      } else {
        await api.createJournal(payload);
      }

      setIsDialogOpen(false);
      setEditingEntry(null);
      resetForm();
      loadEntries();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save entry');
    }
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setFormData({
      entryDate: entry.entryDate,
      referenceNumber: entry.referenceNumber || '',
      description: entry.description || '',
      lines: entry.lines.map((l) => ({
        accountId: l.accountId,
        description: l.description || '',
        debit: l.debit || 0,
        credit: l.credit || 0,
      })),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (entry: JournalEntry) => {
    if (!confirm(`Delete entry "${entry.referenceNumber || entry.description}"? This cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteJournal(entry.id);
      loadEntries();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete entry');
    }
  };

  const handlePost = async (entry: JournalEntry) => {
    if (!confirm('Post this entry? Once posted, it cannot be edited or deleted.')) {
      return;
    }
    try {
      await api.postJournal(entry.id);
      loadEntries();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to post entry');
    }
  };

  const handlePostAll = async () => {
    const draftEntries = entries.filter((e) => e.status === 'draft');
    if (draftEntries.length === 0) {
      alert('No draft entries to post.');
      return;
    }
    if (!confirm(`Post all ${draftEntries.length} draft entries? Once posted, they cannot be edited or deleted.`)) {
      return;
    }
    setIsPostingAll(true);
    let successCount = 0;
    let failCount = 0;
    for (const entry of draftEntries) {
      try {
        await api.postJournal(entry.id);
        successCount++;
      } catch (error) {
        console.error(`Failed to post entry ${entry.id}:`, error);
        failCount++;
      }
    }
    setIsPostingAll(false);
    loadEntries();
    if (failCount > 0) {
      alert(`Posted ${successCount} entries. ${failCount} entries failed to post.`);
    } else {
      alert(`Successfully posted ${successCount} entries.`);
    }
  };

  // Multi-select handlers - now supports ALL entries
  const draftEntries = entries.filter((e) => e.status === 'draft');
  const postedEntries = entries.filter((e) => e.status === 'posted');
  const draftCount = draftEntries.length;
  const postedCount = postedEntries.length;

  // Get selected entries by status
  // When we have allEntryIds, use that for counting; otherwise use current page entries
  const selectedIds = Array.from(selectedEntries);
  const selectedCount = selectedIds.length;

  // For entries on current page, we can check status directly
  const selectedDraftIdsOnPage = selectedIds.filter((id) =>
    draftEntries.some((e) => e.id === id)
  );
  const selectedPostedIdsOnPage = selectedIds.filter((id) =>
    postedEntries.some((e) => e.id === id)
  );

  // Estimate counts: if we selected all, count total drafts/posted in the journal
  // Otherwise use what we can see on the current page
  const selectedDraftCount = allEntryIds.length > 0 && selectedCount === allEntryIds.length
    ? selectedCount // All selected - we'll filter by status during operation
    : selectedDraftIdsOnPage.length;
  const selectedPostedCount = allEntryIds.length > 0 && selectedCount === allEntryIds.length
    ? selectedCount // All selected - we'll filter by status during operation
    : selectedPostedIdsOnPage.length;

  const toggleSelectPage = () => {
    if (selectedCount === filteredEntries.length && filteredEntries.length > 0) {
      // Deselect all on current page
      setSelectedEntries(new Set());
    } else {
      // Select all visible entries on current page
      setSelectedEntries(new Set(filteredEntries.map((e) => e.id)));
    }
  };

  // Select ALL entries across all pages
  const handleSelectAll = async () => {
    if (selectedEntries.size === totalEntries) {
      // Deselect all
      setSelectedEntries(new Set());
      setAllEntryIds([]);
      return;
    }

    setIsSelectingAll(true);
    try {
      // Fetch all entry IDs (up to a reasonable limit)
      const filters: any = { journalTypeId, page: 1, pageSize: 10000 };
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const result = await api.getJournals(filters);
      const allIds = (result?.data || []).map((e: JournalEntry) => e.id);
      setAllEntryIds(allIds);
      setSelectedEntries(new Set(allIds));
    } catch (error) {
      console.error('Failed to select all:', error);
      alert('Failed to select all entries');
    } finally {
      setIsSelectingAll(false);
    }
  };

  const toggleSelectEntry = (entryId: string) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId);
    } else {
      newSelected.add(entryId);
    }
    setSelectedEntries(newSelected);
  };

  const handlePostSelected = async () => {
    const entriesToPost = selectedIds;
    if (entriesToPost.length === 0) {
      alert('No entries selected.');
      return;
    }
    if (!confirm(`Post ${entriesToPost.length} selected entries? (Only draft entries will be posted)`)) {
      return;
    }
    setIsPostingSelected(true);
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    for (const entryId of entriesToPost) {
      try {
        await api.postJournal(entryId);
        successCount++;
      } catch (error: any) {
        // If already posted, count as skipped
        if (error?.message?.includes('status') || error?.message?.includes('POSTED')) {
          skippedCount++;
        } else {
          console.error(`Failed to post entry ${entryId}:`, error);
          failCount++;
        }
      }
    }
    setIsPostingSelected(false);
    setSelectedEntries(new Set());
    setAllEntryIds([]);
    loadEntries();
    let message = `Posted ${successCount} entries.`;
    if (skippedCount > 0) message += ` ${skippedCount} already posted.`;
    if (failCount > 0) message += ` ${failCount} failed.`;
    alert(message);
  };

  const handleUnpostSelected = async () => {
    const entriesToUnpost = selectedIds;
    if (entriesToUnpost.length === 0) {
      alert('No entries selected.');
      return;
    }
    if (!confirm(`Unpost ${entriesToUnpost.length} selected entries? (Only posted entries will be unposted)`)) {
      return;
    }
    setIsUnpostingSelected(true);
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    for (const entryId of entriesToUnpost) {
      try {
        await api.unpostJournal(entryId);
        successCount++;
      } catch (error: any) {
        // If already draft, count as skipped
        if (error?.message?.includes('status') || error?.message?.includes('DRAFT')) {
          skippedCount++;
        } else {
          console.error(`Failed to unpost entry ${entryId}:`, error);
          failCount++;
        }
      }
    }
    setIsUnpostingSelected(false);
    setSelectedEntries(new Set());
    setAllEntryIds([]);
    loadEntries();
    let message = `Unposted ${successCount} entries.`;
    if (skippedCount > 0) message += ` ${skippedCount} already drafts.`;
    if (failCount > 0) message += ` ${failCount} failed.`;
    alert(message);
  };

  const handleDeleteSelected = async () => {
    const entriesToDelete = selectedIds;
    if (entriesToDelete.length === 0) {
      alert('No entries selected.');
      return;
    }
    if (!confirm(`Delete ${entriesToDelete.length} selected entries? (Only draft entries can be deleted) This cannot be undone.`)) {
      return;
    }
    setIsDeletingSelected(true);
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    for (const entryId of entriesToDelete) {
      try {
        await api.deleteJournal(entryId);
        successCount++;
      } catch (error: any) {
        // If posted, count as skipped
        if (error?.message?.includes('posted') || error?.message?.includes('POSTED')) {
          skippedCount++;
        } else {
          console.error(`Failed to delete entry ${entryId}:`, error);
          failCount++;
        }
      }
    }
    setIsDeletingSelected(false);
    setSelectedEntries(new Set());
    setAllEntryIds([]);
    loadEntries();
    let message = `Deleted ${successCount} entries.`;
    if (skippedCount > 0) message += ` ${skippedCount} skipped (posted).`;
    if (failCount > 0) message += ` ${failCount} failed.`;
    alert(message);
  };

  const resetForm = () => {
    setFormData({
      entryDate: new Date().toISOString().split('T')[0],
      referenceNumber: '',
      description: '',
      lines: [
        { accountId: '', description: '', debit: 0, credit: 0 },
        { accountId: '', description: '', debit: 0, credit: 0 },
      ],
    });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { accountId: '', description: '', debit: 0, credit: 0 }],
    });
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setFormData({ ...formData, lines: newLines });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length <= 2) return;
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index),
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const totalDebit = formData.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = formData.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  if (!journalType && !isLoading) {
    return (
      <div className="p-8">
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-zinc-300" />
          <p className="text-lg font-medium text-zinc-900">Journal type not found</p>
          <Link href="/journals" className="text-emerald-600 hover:underline mt-2 inline-block">
            Back to Journals
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/journals"
          className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Journal Types
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              {journalType?.name || 'Loading...'}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Manage entries for {journalType?.code || ''} journal
              {totalEntries > 0 && <span className="ml-2 text-zinc-500">({totalEntries.toLocaleString()} total entries)</span>}
            </p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setEditingEntry(null);
              setIsDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Entry
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search by description or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-zinc-400" />
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
            placeholder="Start date"
          />
          <span className="text-zinc-400">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
            placeholder="End date"
          />
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {!isLoading && totalEntries > 0 && (
        <div className="mb-4 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Select All Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={isSelectingAll}
                className={selectedEntries.size === totalEntries ? 'bg-emerald-100 border-emerald-300' : ''}
              >
                {isSelectingAll ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="mr-2 h-4 w-4" />
                )}
                {selectedEntries.size === totalEntries
                  ? 'Deselect All'
                  : `Select All (${totalEntries.toLocaleString()})`}
              </Button>

              {/* Selection status */}
              {selectedCount > 0 && (
                <span className="text-sm text-zinc-600">
                  <strong>{selectedCount.toLocaleString()}</strong> selected
                  {selectedDraftCount > 0 && selectedPostedCount > 0 && (
                    <span className="ml-1">
                      ({selectedDraftCount} draft, {selectedPostedCount} posted)
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Bulk Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Delete button */}
              <Button
                onClick={handleDeleteSelected}
                disabled={isDeletingSelected || selectedCount === 0}
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
              >
                {isDeletingSelected ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete
              </Button>

              {/* Unpost button */}
              <Button
                onClick={handleUnpostSelected}
                disabled={isUnpostingSelected || selectedCount === 0}
                variant="outline"
                size="sm"
                className="text-amber-600 border-amber-200 hover:bg-amber-50 disabled:opacity-50"
              >
                {isUnpostingSelected ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Undo2 className="mr-2 h-4 w-4" />
                )}
                Unpost
              </Button>

              {/* Post button */}
              <Button
                onClick={handlePostSelected}
                disabled={isPostingSelected || selectedCount === 0}
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-200 hover:bg-blue-50 disabled:opacity-50"
              >
                {isPostingSelected ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Post
              </Button>

              {selectedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedEntries(new Set());
                    setAllEntryIds([]);
                  }}
                  className="text-zinc-600 hover:text-zinc-900"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Entries Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
        </div>
      ) : filteredEntries.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-zinc-300" />
          <p className="text-lg font-medium text-zinc-900">No entries found</p>
          <p className="text-sm text-zinc-500 mt-1">
            {searchQuery || startDate || endDate || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first entry to get started'}
          </p>
        </Card>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedCount === filteredEntries.length && filteredEntries.length > 0}
                    onCheckedChange={toggleSelectPage}
                    aria-label="Select all entries on this page"
                  />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => {
                const totalDebit = entry.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
                const totalCredit = entry.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedEntries.has(entry.id)}
                        onCheckedChange={() => toggleSelectEntry(entry.id)}
                        aria-label={`Select entry ${entry.referenceNumber || entry.description}`}
                      />
                    </TableCell>
                    <TableCell>{new Date(entry.entryDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{entry.referenceNumber || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate">{entry.description || '-'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalDebit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalCredit)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          entry.status === 'posted'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View/Edit button for all entries */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                          title={entry.status === 'draft' ? 'Edit entry' : 'View entry'}
                        >
                          {entry.status === 'draft' ? (
                            <Pencil className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        {entry.status === 'draft' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePost(entry)}
                              title="Post entry"
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(entry)}
                              title="Delete entry"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200">
              <div className="text-sm text-zinc-600">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalEntries)} of {totalEntries.toLocaleString()} entries
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-zinc-600">Page</span>
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const page = parseInt(e.target.value);
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page);
                      }
                    }}
                    className="w-16 h-8 text-center"
                  />
                  <span className="text-zinc-600">of {totalPages}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[1400px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntry
                ? editingEntry.status === 'posted'
                  ? 'View Journal Entry'
                  : 'Edit Journal Entry'
                : 'New Journal Entry'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {editingEntry?.status === 'posted' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                This entry has been posted and cannot be modified.
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Entry Date *</Label>
                <Input
                  type="date"
                  value={formData.entryDate}
                  onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                  required
                  disabled={editingEntry?.status === 'posted'}
                />
              </div>
              <div>
                <Label>Reference Number</Label>
                <Input
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                  placeholder="Optional reference"
                  disabled={editingEntry?.status === 'posted'}
                />
              </div>
              <div>
                <Label>Description *</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Entry description"
                  required
                  disabled={editingEntry?.status === 'posted'}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                {editingEntry?.status !== 'posted' && (
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Line
                  </Button>
                )}
              </div>
              <div className="border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-zinc-500">
                  <div className="col-span-4">Account</div>
                  <div className="col-span-3">Description</div>
                  <div className="col-span-2">Debit</div>
                  <div className="col-span-2">Credit</div>
                  <div className="col-span-1"></div>
                </div>
                {formData.lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <Select
                        value={line.accountId}
                        onValueChange={(value) => updateLine(index, 'accountId', value)}
                        disabled={editingEntry?.status === 'posted'}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.accountCode} - {a.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                        placeholder="Line memo"
                        disabled={editingEntry?.status === 'posted'}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.debit || ''}
                        onChange={(e) =>
                          updateLine(index, 'debit', parseFloat(e.target.value) || 0)
                        }
                        placeholder="0.00"
                        disabled={editingEntry?.status === 'posted'}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.credit || ''}
                        onChange={(e) =>
                          updateLine(index, 'credit', parseFloat(e.target.value) || 0)
                        }
                        placeholder="0.00"
                        disabled={editingEntry?.status === 'posted'}
                      />
                    </div>
                    <div className="col-span-1">
                      {editingEntry?.status !== 'posted' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(index)}
                          disabled={formData.lines.length <= 2}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3 mt-3">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-7 text-right font-medium">Totals:</div>
                    <div className="col-span-2 text-right font-medium">
                      {formatCurrency(totalDebit)}
                    </div>
                    <div className="col-span-2 text-right font-medium">
                      {formatCurrency(totalCredit)}
                    </div>
                    <div className="col-span-1"></div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 mt-2">
                    <div className="col-span-7"></div>
                    <div className="col-span-4">
                      {isBalanced ? (
                        <Badge className="bg-emerald-100 text-emerald-700">Balanced</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700">
                          Out of balance by {formatCurrency(Math.abs(totalDebit - totalCredit))}
                        </Badge>
                      )}
                    </div>
                    <div className="col-span-1"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              {editingEntry?.status === 'posted' ? (
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Close
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={!isBalanced}
                  >
                    {editingEntry ? 'Save Changes' : 'Create Entry'}
                  </Button>
                </>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
