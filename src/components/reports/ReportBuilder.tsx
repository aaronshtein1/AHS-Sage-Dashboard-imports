'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  CustomReportDefinition,
  GeneratedCustomReport,
  CustomReportRow,
  PeriodConfig,
  ReportComparisonConfig,
  CustomReportAccountFilters,
  CustomReportGrouping,
  CustomColumn,
} from '@/types';
import { api } from '@/lib/api';
import { getDefaultColumns } from '@/lib/reports/column-definitions';
import { getCurrentPeriod } from '@/lib/reports/period-utils';

import { ColumnSelector } from './ColumnSelector';
import { PeriodSelector } from './PeriodSelector';
import { ComparisonConfig } from './ComparisonConfig';
import { AccountFilters } from './AccountFilters';
import { GroupingOptions } from './GroupingOptions';
import { ReportPreview } from './ReportPreview';
import { SaveReportDialog } from './SaveReportDialog';
import { DrillThroughDialog } from './DrillThroughDialog';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Save,
  Copy,
  Play,
  Columns,
  Calendar,
  ArrowLeftRight,
  Filter,
  Layers,
} from 'lucide-react';

interface ReportBuilderProps {
  initialDefinition?: CustomReportDefinition;
  onSaved?: (definition: CustomReportDefinition) => void;
}

function createEmptyDefinition(): CustomReportDefinition {
  return {
    id: '',
    name: 'New Custom Report',
    description: '',
    columns: getDefaultColumns(),
    period: {
      type: 'single',
      startPeriod: getCurrentPeriod(),
    },
    comparison: undefined,
    accountFilters: {
      includeZeroBalances: false,
      includeInactiveAccounts: false,
    },
    grouping: {
      groupBy: 'none',
      showSubtotals: true,
      showGrandTotal: true,
    },
    isSystemReport: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function ReportBuilder({ initialDefinition, onSaved }: ReportBuilderProps) {
  const [definition, setDefinition] = useState<CustomReportDefinition>(
    initialDefinition || createEmptyDefinition()
  );
  const [report, setReport] = useState<GeneratedCustomReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveAs, setSaveAs] = useState(false);
  const [drillThroughRow, setDrillThroughRow] = useState<CustomReportRow | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Update definition and mark as dirty
  const updateDefinition = useCallback(
    <K extends keyof CustomReportDefinition>(
      key: K,
      value: CustomReportDefinition[K]
    ) => {
      setDefinition((prev) => ({ ...prev, [key]: value }));
      setIsDirty(true);
    },
    []
  );

  // Generate report preview
  const generateReport = useCallback(async () => {
    setIsGenerating(true);
    try {
      const generated = await api.generateCustomReport(definition);
      setReport(generated);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [definition]);

  // Auto-generate on first load if we have an initial definition
  useEffect(() => {
    if (initialDefinition) {
      generateReport();
    }
  }, []);

  // Handle save
  const handleSave = async (def: CustomReportDefinition) => {
    const saved = await api.saveCustomReport(def);
    setDefinition(saved);
    setIsDirty(false);
    onSaved?.(saved);
  };

  // Handle drill-through
  const handleDrillThrough = (row: CustomReportRow) => {
    if (row.drillThroughParams) {
      setDrillThroughRow(row);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">
              {definition.name || 'New Custom Report'}
            </h1>
            {definition.description && (
              <p className="text-sm text-zinc-500 mt-0.5">
                {definition.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSaveAs(true);
                setShowSaveDialog(true);
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Save As
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSaveAs(false);
                setShowSaveDialog(true);
              }}
              disabled={!isDirty && !!definition.id}
            >
              <Save className="h-4 w-4 mr-2" />
              {definition.id ? 'Save' : 'Save'}
            </Button>
            <Button
              onClick={generateReport}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={isGenerating}
            >
              <Play className="h-4 w-4 mr-2" />
              {isGenerating ? 'Generating...' : 'Generate'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Builder Controls */}
        <div className="w-[400px] border-r border-zinc-200 bg-zinc-50 overflow-y-auto">
          <Tabs defaultValue="columns" className="h-full">
            <TabsList className="w-full rounded-none border-b border-zinc-200 bg-white p-0 h-auto">
              <TabsTrigger
                value="columns"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent py-3"
              >
                <Columns className="h-4 w-4 mr-1.5" />
                Columns
              </TabsTrigger>
              <TabsTrigger
                value="period"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent py-3"
              >
                <Calendar className="h-4 w-4 mr-1.5" />
                Period
              </TabsTrigger>
              <TabsTrigger
                value="compare"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent py-3"
              >
                <ArrowLeftRight className="h-4 w-4 mr-1.5" />
                Compare
              </TabsTrigger>
            </TabsList>

            <TabsList className="w-full rounded-none border-b border-zinc-200 bg-white p-0 h-auto">
              <TabsTrigger
                value="filters"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent py-3"
              >
                <Filter className="h-4 w-4 mr-1.5" />
                Filters
              </TabsTrigger>
              <TabsTrigger
                value="grouping"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent py-3"
              >
                <Layers className="h-4 w-4 mr-1.5" />
                Grouping
              </TabsTrigger>
            </TabsList>

            <div className="p-4">
              <TabsContent value="columns" className="mt-0">
                <ColumnSelector
                  columns={definition.columns}
                  onChange={(columns) => updateDefinition('columns', columns)}
                />
              </TabsContent>

              <TabsContent value="period" className="mt-0">
                <PeriodSelector
                  config={definition.period}
                  onChange={(period) => updateDefinition('period', period)}
                />
              </TabsContent>

              <TabsContent value="compare" className="mt-0">
                <ComparisonConfig
                  config={definition.comparison}
                  onChange={(comparison) => updateDefinition('comparison', comparison)}
                />
              </TabsContent>

              <TabsContent value="filters" className="mt-0">
                <AccountFilters
                  filters={definition.accountFilters}
                  onChange={(filters) => updateDefinition('accountFilters', filters)}
                />
              </TabsContent>

              <TabsContent value="grouping" className="mt-0">
                <GroupingOptions
                  grouping={definition.grouping}
                  onChange={(grouping) => updateDefinition('grouping', grouping)}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Right Panel - Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          <ReportPreview
            definition={definition}
            report={report}
            isLoading={isGenerating}
            onRefresh={generateReport}
            onDrillThrough={handleDrillThrough}
          />
        </div>
      </div>

      {/* Save Dialog */}
      <SaveReportDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        definition={definition}
        onSave={handleSave}
        saveAs={saveAs}
      />

      {/* Drill-Through Dialog */}
      {drillThroughRow?.drillThroughParams && (
        <DrillThroughDialog
          open={!!drillThroughRow}
          onClose={() => setDrillThroughRow(null)}
          accountId={drillThroughRow.drillThroughParams.accountId}
          accountTitle={drillThroughRow.accountTitle}
          startDate={drillThroughRow.drillThroughParams.startDate}
          endDate={drillThroughRow.drillThroughParams.endDate}
        />
      )}
    </div>
  );
}
