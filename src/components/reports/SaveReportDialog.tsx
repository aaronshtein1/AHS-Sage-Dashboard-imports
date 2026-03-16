'use client';

import { useState } from 'react';
import type { CustomReportDefinition } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2 } from 'lucide-react';

interface SaveReportDialogProps {
  open: boolean;
  onClose: () => void;
  definition: CustomReportDefinition;
  onSave: (definition: CustomReportDefinition) => Promise<void>;
  saveAs?: boolean;
}

export function SaveReportDialog({
  open,
  onClose,
  definition,
  onSave,
  saveAs = false,
}: SaveReportDialogProps) {
  const [name, setName] = useState(saveAs ? `${definition.name} (Copy)` : definition.name);
  const [description, setDescription] = useState(definition.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Report name is required');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const updatedDefinition: CustomReportDefinition = {
        ...definition,
        id: saveAs ? '' : definition.id,
        name: name.trim(),
        description: description.trim() || undefined,
      };

      await onSave(updatedDefinition);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save report');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {saveAs ? 'Save Report As' : definition.id ? 'Update Report' : 'Save Report'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="report-name">Report Name</Label>
            <Input
              id="report-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter report name"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="report-description">Description (optional)</Label>
            <Textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a description for this report"
              className="mt-1.5"
              rows={3}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
