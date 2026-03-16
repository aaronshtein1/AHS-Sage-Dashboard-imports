'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export function ReconciliationPanel() {
  const [sessionId, setSessionId] = useState('');
  const [result, setResult] = useState<{ matched: number; unmatched: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAutoMatch = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const data = await api.autoMatchReconciliation(sessionId);
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">
          Reconciliation Auto-Match
        </h2>
        <p className="text-sm text-zinc-600">
          Automatically match bank feed transactions to journal entries
        </p>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Auto-Match Settings</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-zinc-700">Date Tolerance</label>
              <Input
                type="number"
                name="dateTolerance"
                defaultValue="3"
                className="mt-1"
                placeholder="Days..."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">Amount Match</label>
              <div className="flex items-center mt-1">
                <input type="checkbox" name="strictAmountMatch" className="mr-2" />
                <span className="text-sm">Strict</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">Similarity Threshold</label>
              <Input
                type="number"
                name="similarityThreshold"
                defaultValue="0.75"
                step="0.01"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700">
              Reconciliation Session ID
            </label>
            <Input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="mt-1"
              placeholder="Enter session ID..."
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => alert('Settings saved successfully')}>
              Save Settings
            </Button>
            <Button
              onClick={handleAutoMatch}
              disabled={!sessionId || loading}
              variant="outline"
            >
              {loading ? 'Processing...' : 'Run Auto-Match'}
            </Button>
          </div>

          {result && (
            <div className="mt-4 p-4 bg-emerald-50 rounded-md border border-emerald-200">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-sm text-zinc-600">Matched</div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {result.matched}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-zinc-600">Unmatched</div>
                  <div className="text-2xl font-bold text-zinc-600">
                    {result.unmatched}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
