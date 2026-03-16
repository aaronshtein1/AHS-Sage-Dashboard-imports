'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { JournalType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Pencil, Trash2, ChevronRight, FolderOpen, Upload } from 'lucide-react';
import Link from 'next/link';

export default function JournalsPage() {
  const [journalTypes, setJournalTypes] = useState<JournalType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<JournalType | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
  });

  useEffect(() => {
    loadJournalTypes();
  }, []);

  const loadJournalTypes = async () => {
    try {
      const types = await api.getJournalTypes();
      setJournalTypes(Array.isArray(types) ? types : []);
    } catch (error) {
      console.error('Failed to load journal types:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingType) {
        await api.updateJournalType(editingType.id, {
          name: formData.name,
          description: formData.description,
        });
      } else {
        await api.createJournalType(formData);
      }
      setIsDialogOpen(false);
      setEditingType(null);
      resetForm();
      loadJournalTypes();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save journal type');
    }
  };

  const handleEdit = (type: JournalType) => {
    setEditingType(type);
    setFormData({
      code: type.code,
      name: type.name,
      description: type.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (type: JournalType) => {
    if (!confirm(`Delete journal type "${type.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteJournalType(type.id);
      loadJournalTypes();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete journal type');
    }
  };

  const resetForm = () => {
    setFormData({ code: '', name: '', description: '' });
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Journals</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Manage journal types and their entries
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/journals/import-sage">
            <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
              <Upload className="mr-2 h-4 w-4" />
              Import Sage Report
            </Button>
          </Link>
          <Link href="/journals/import">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </Link>
          <Button
            onClick={() => {
              resetForm();
              setEditingType(null);
              setIsDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Journal Type
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
        </div>
      ) : journalTypes.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-zinc-300" />
          <p className="text-lg font-medium text-zinc-900">No journal types found</p>
          <p className="text-sm text-zinc-500 mt-1">Create a journal type to get started</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {journalTypes.map((type) => (
            <Card
              key={type.id}
              className="p-6 hover:border-emerald-300 transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <FileText className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900">{type.name}</h3>
                    <Badge variant="outline" className="mt-1">{type.code}</Badge>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(type)}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(type)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {type.description && (
                <p className="text-sm text-zinc-500 mb-4 line-clamp-2">
                  {type.description}
                </p>
              )}

              <Link
                href={`/journals/${type.id}/entries`}
                className="flex items-center justify-between p-3 -mx-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors"
              >
                <span className="text-sm font-medium text-zinc-700">View Entries</span>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'Edit Journal Type' : 'New Journal Type'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Code *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="GJ"
                required
                disabled={!!editingType}
                maxLength={10}
              />
              {editingType && (
                <p className="text-xs text-zinc-500 mt-1">Code cannot be changed</p>
              )}
            </div>
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="General Journal"
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="For general journal entries"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                {editingType ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
