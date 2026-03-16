'use client';

import type { CustomReportDefinition } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  MoreVertical,
  Play,
  Edit,
  Copy,
  Trash2,
  Plus,
} from 'lucide-react';

interface SavedReportsListProps {
  reports: CustomReportDefinition[];
  onSelect: (report: CustomReportDefinition) => void;
  onRun: (report: CustomReportDefinition) => void;
  onEdit: (report: CustomReportDefinition) => void;
  onDuplicate: (report: CustomReportDefinition) => void;
  onDelete: (report: CustomReportDefinition) => void;
  onNew: () => void;
  selectedId?: string;
}

export function SavedReportsList({
  reports,
  onSelect,
  onRun,
  onEdit,
  onDuplicate,
  onDelete,
  onNew,
  selectedId,
}: SavedReportsListProps) {
  const systemReports = reports.filter((r) => r.isSystemReport);
  const customReports = reports.filter((r) => !r.isSystemReport);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const ReportCard = ({ report }: { report: CustomReportDefinition }) => (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors
        ${selectedId === report.id
          ? 'bg-emerald-50 border border-emerald-200'
          : 'hover:bg-zinc-50 border border-transparent'
        }
      `}
      onClick={() => onSelect(report)}
    >
      <div
        className={`
          p-2 rounded-md
          ${selectedId === report.id
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-zinc-100 text-zinc-600'
          }
        `}
      >
        <FileText className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-zinc-900 truncate">
            {report.name}
          </span>
          {report.isSystemReport && (
            <Badge variant="secondary" className="text-xs">
              System
            </Badge>
          )}
        </div>
        {report.description && (
          <p className="text-xs text-zinc-500 mt-0.5 truncate">
            {report.description}
          </p>
        )}
        <p className="text-xs text-zinc-400 mt-1">
          Updated {formatDate(report.updatedAt)}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onRun(report)}>
            <Play className="h-4 w-4 mr-2" />
            Run Report
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(report)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDuplicate(report)}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
          {!report.isSystemReport && (
            <DropdownMenuItem
              onClick={() => onDelete(report)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-zinc-900">Custom Reports</h2>
        <Button
          size="sm"
          onClick={onNew}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>

      <div className="space-y-4">
        {/* Custom Reports */}
        {customReports.length > 0 && (
          <div className="space-y-1">
            {customReports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}

        {customReports.length === 0 && (
          <div className="text-center py-6 text-sm text-zinc-500">
            <FileText className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
            <p>No custom reports yet</p>
            <p className="text-xs mt-1">
              Click New to create your first report
            </p>
          </div>
        )}

        {/* System Reports */}
        {systemReports.length > 0 && (
          <>
            <div className="border-t border-zinc-200 pt-4">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                System Reports
              </h3>
              <div className="space-y-1">
                {systemReports.map((report) => (
                  <ReportCard key={report.id} report={report} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
