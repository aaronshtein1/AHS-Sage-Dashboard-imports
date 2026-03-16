'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CustomReportDefinition } from '@/types';
import { api } from '@/lib/api';
import { ReportBuilder } from '@/components/reports/ReportBuilder';
import { SavedReportsList } from '@/components/reports/SavedReportsList';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';

export default function CustomReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id');

  const [reports, setReports] = useState<CustomReportDefinition[]>([]);
  const [selectedReport, setSelectedReport] = useState<CustomReportDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);

  // Load saved reports
  useEffect(() => {
    loadReports();
  }, []);

  // Load specific report if ID is in URL
  useEffect(() => {
    if (reportId && reports.length > 0) {
      const report = reports.find((r) => r.id === reportId);
      if (report) {
        setSelectedReport(report);
        setShowBuilder(true);
      }
    }
  }, [reportId, reports]);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const defs = await api.getCustomReportDefinitions();
      setReports(defs);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNew = () => {
    setSelectedReport(null);
    setShowBuilder(true);
  };

  const handleSelect = (report: CustomReportDefinition) => {
    setSelectedReport(report);
  };

  const handleRun = (report: CustomReportDefinition) => {
    setSelectedReport(report);
    setShowBuilder(true);
  };

  const handleEdit = (report: CustomReportDefinition) => {
    setSelectedReport(report);
    setShowBuilder(true);
  };

  const handleDuplicate = async (report: CustomReportDefinition) => {
    const duplicate: CustomReportDefinition = {
      ...report,
      id: '',
      name: `${report.name} (Copy)`,
      isSystemReport: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await api.saveCustomReport(duplicate);
    setReports([...reports, saved]);
  };

  const handleDelete = async (report: CustomReportDefinition) => {
    if (confirm(`Are you sure you want to delete "${report.name}"?`)) {
      await api.deleteCustomReport(report.id);
      setReports(reports.filter((r) => r.id !== report.id));
      if (selectedReport?.id === report.id) {
        setSelectedReport(null);
      }
    }
  };

  const handleSaved = (report: CustomReportDefinition) => {
    const existing = reports.findIndex((r) => r.id === report.id);
    if (existing >= 0) {
      setReports(reports.map((r) => (r.id === report.id ? report : r)));
    } else {
      setReports([...reports, report]);
    }
    setSelectedReport(report);
  };

  const handleBack = () => {
    if (showBuilder) {
      setShowBuilder(false);
    } else {
      router.push('/reports');
    }
  };

  if (showBuilder) {
    return (
      <div className="h-screen flex flex-col">
        <div className="px-4 py-2 border-b border-zinc-200 bg-zinc-50">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <ReportBuilder
            initialDefinition={selectedReport || undefined}
            onSaved={handleSaved}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/reports')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              Custom Report Builder
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Create and manage custom financial reports with flexible columns, periods, and comparisons
            </p>
          </div>
          <Button
            onClick={handleNew}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Report
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Report List */}
        <div className="col-span-4">
          <SavedReportsList
            reports={reports}
            onSelect={handleSelect}
            onRun={handleRun}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onNew={handleNew}
            selectedId={selectedReport?.id}
          />
        </div>

        {/* Selected Report Preview */}
        <div className="col-span-8">
          {selectedReport ? (
            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900">
                    {selectedReport.name}
                  </h2>
                  {selectedReport.description && (
                    <p className="text-sm text-zinc-500 mt-1">
                      {selectedReport.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => handleEdit(selectedReport)}>
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleRun(selectedReport)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Run Report
                  </Button>
                </div>
              </div>

              {/* Report Configuration Summary */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-zinc-700 mb-2">Columns</h3>
                  <div className="space-y-1">
                    {selectedReport.columns
                      .filter((c) => c.visible)
                      .sort((a, b) => a.order - b.order)
                      .map((col) => (
                        <div
                          key={col.id}
                          className="text-sm text-zinc-600 flex items-center gap-2"
                        >
                          <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                          {col.label}
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-zinc-700 mb-2">Settings</h3>
                  <div className="space-y-2 text-sm text-zinc-600">
                    <div>
                      <span className="font-medium">Period:</span>{' '}
                      {selectedReport.period.type.replace('-', ' ').toUpperCase()}
                    </div>
                    {selectedReport.comparison?.enabled && (
                      <div>
                        <span className="font-medium">Comparison:</span>{' '}
                        {selectedReport.comparison.type.replace('-', ' ')}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Grouping:</span>{' '}
                      {selectedReport.grouping.groupBy === 'none'
                        ? 'None'
                        : selectedReport.grouping.groupBy.replace('-', ' ')}
                    </div>
                    {(selectedReport.accountFilters.accountTypes?.length ?? 0) > 0 && (
                      <div>
                        <span className="font-medium">Account Types:</span>{' '}
                        {selectedReport.accountFilters.accountTypes?.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-200 text-xs text-zinc-400">
                Created: {new Date(selectedReport.createdAt).toLocaleDateString()} |
                Updated: {new Date(selectedReport.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-50 border border-zinc-200 border-dashed rounded-lg p-12 text-center">
              <div className="text-zinc-400 mb-4">
                <Plus className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-zinc-700 mb-2">
                Select or Create a Report
              </h3>
              <p className="text-sm text-zinc-500 mb-4">
                Choose a report from the list or create a new one to get started
              </p>
              <Button
                onClick={handleNew}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Report
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
