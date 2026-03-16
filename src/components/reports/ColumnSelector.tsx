'use client';

import { useState } from 'react';
import type { CustomColumn, CustomColumnType } from '@/types';
import {
  COLUMN_DEFINITIONS,
  getColumnsByCategory,
  CATEGORY_LABELS,
  createColumn,
} from '@/lib/reports/column-definitions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  ChevronUp,
  ChevronDown,
  GripVertical,
  X,
  Plus,
} from 'lucide-react';

interface ColumnSelectorProps {
  columns: CustomColumn[];
  onChange: (columns: CustomColumn[]) => void;
}

export function ColumnSelector({ columns, onChange }: ColumnSelectorProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['account-info', 'balances'])
  );

  const columnsByCategory = getColumnsByCategory();

  const isColumnSelected = (type: CustomColumnType) => {
    return columns.some((c) => c.type === type && c.visible);
  };

  const toggleColumn = (type: CustomColumnType) => {
    const existing = columns.find((c) => c.type === type);
    if (existing) {
      // Toggle visibility
      onChange(
        columns.map((c) =>
          c.type === type ? { ...c, visible: !c.visible } : c
        )
      );
    } else {
      // Add new column
      const newColumn = createColumn(type, columns.length);
      onChange([...columns, newColumn]);
    }
  };

  const removeColumn = (columnId: string) => {
    onChange(columns.filter((c) => c.id !== columnId));
  };

  const moveColumn = (columnId: string, direction: 'up' | 'down') => {
    const visibleColumns = columns.filter((c) => c.visible);
    const index = visibleColumns.findIndex((c) => c.id === columnId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= visibleColumns.length) return;

    // Swap order values
    const newColumns = columns.map((c) => {
      if (c.id === visibleColumns[index].id) {
        return { ...c, order: visibleColumns[newIndex].order };
      }
      if (c.id === visibleColumns[newIndex].id) {
        return { ...c, order: visibleColumns[index].order };
      }
      return c;
    });

    onChange(newColumns);
  };

  const updateColumnLabel = (columnId: string, label: string) => {
    onChange(columns.map((c) => (c.id === columnId ? { ...c, label } : c)));
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const visibleColumns = columns
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Selected Columns */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 mb-3">
          Selected Columns ({visibleColumns.length})
        </h3>
        <p className="text-xs text-zinc-500 mb-3">
          Drag to reorder or use arrows. Click X to remove.
        </p>

        {visibleColumns.length === 0 ? (
          <div className="text-sm text-zinc-400 italic py-4 text-center border border-dashed border-zinc-200 rounded-lg">
            No columns selected. Add columns from below.
          </div>
        ) : (
          <div className="space-y-2">
            {visibleColumns.map((column, index) => (
              <div
                key={column.id}
                className="flex items-center gap-2 p-2 bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 transition-colors"
              >
                <GripVertical className="h-4 w-4 text-zinc-400 cursor-grab" />

                <Input
                  value={column.label}
                  onChange={(e) => updateColumnLabel(column.id, e.target.value)}
                  className="flex-1 h-8 text-sm"
                />

                <span className="text-xs text-zinc-400 px-2">
                  {column.dataType}
                </span>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => moveColumn(column.id, 'up')}
                    disabled={index === 0}
                    className="h-6 w-6"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => moveColumn(column.id, 'down')}
                    disabled={index === visibleColumns.length - 1}
                    className="h-6 w-6"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeColumn(column.id)}
                    className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Columns by Category */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 mb-3">
          Available Columns
        </h3>

        <div className="space-y-3">
          {Object.entries(columnsByCategory).map(([category, categoryColumns]) => (
            <div
              key={category}
              className="border border-zinc-200 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-3 py-2 bg-zinc-50 hover:bg-zinc-100 transition-colors"
              >
                <span className="text-sm font-medium text-zinc-700">
                  {CATEGORY_LABELS[category] || category}
                </span>
                <span className="text-xs text-zinc-400">
                  {categoryColumns.filter((c) => isColumnSelected(c.type)).length}/
                  {categoryColumns.length}
                </span>
              </button>

              {expandedCategories.has(category) && (
                <div className="p-3 space-y-2 bg-white">
                  {categoryColumns.map((colDef) => (
                    <div
                      key={colDef.type}
                      className="flex items-start gap-2"
                    >
                      <Checkbox
                        id={colDef.type}
                        checked={isColumnSelected(colDef.type)}
                        onCheckedChange={() => toggleColumn(colDef.type)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={colDef.type}
                          className="text-sm cursor-pointer"
                        >
                          {colDef.label}
                        </Label>
                        <p className="text-xs text-zinc-400">
                          {colDef.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
