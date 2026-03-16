'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PlaidLinkButton } from './plaid-link-button';
import { Button } from '@/components/ui/button';

interface FlatAccount {
  id: string;
  plaidItemId: string;
  institutionName: string;
  accountName: string;
  type: string;
  subtype?: string;
  mask?: string;
  balance: number | null;
  lastSync: string | null;
}

export function BankAccountsList() {
  const [accounts, setAccounts] = useState<FlatAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const plaidItems = await api.getPlaidAccounts();

      // Flatten PlaidItem[] with nested accounts into a flat list
      const flatAccounts: FlatAccount[] = [];
      for (const item of plaidItems) {
        for (const account of item.accounts || []) {
          flatAccounts.push({
            id: account.id,
            plaidItemId: item.id,
            institutionName: item.plaidInstitutionName || 'Unknown Institution',
            accountName: account.officialName || account.name || 'Unknown Account',
            type: account.type || 'unknown',
            subtype: account.subtype,
            mask: account.mask,
            balance: account.currentBalance ? parseFloat(account.currentBalance.toString()) : null,
            lastSync: item.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleDateString() : null,
          });
        }
      }

      setAccounts(flatAccounts);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (plaidItemId: string) => {
    try {
      await api.syncPlaidTransactions(plaidItemId);
      await loadAccounts();
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  };

  const handleDisconnect = async (plaidItemId: string, institutionName: string) => {
    if (!confirm(`Are you sure you want to disconnect ${institutionName}? This will remove all associated accounts and transactions.`)) {
      return;
    }

    try {
      await api.disconnectPlaidAccount(plaidItemId);
      await loadAccounts();
    } catch (error) {
      console.error('Failed to disconnect:', error);
      alert('Failed to disconnect account. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Connected Accounts</h2>
        <PlaidLinkButton
          onSuccess={() => loadAccounts()}
          onError={(err) => console.error(err)}
        />
      </div>

      <div className="bg-white rounded-lg border border-zinc-200">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left p-3 text-sm font-medium text-zinc-700">Institution</th>
              <th className="text-left p-3 text-sm font-medium text-zinc-700">Account</th>
              <th className="text-left p-3 text-sm font-medium text-zinc-700">Type</th>
              <th className="text-right p-3 text-sm font-medium text-zinc-700">Balance</th>
              <th className="text-left p-3 text-sm font-medium text-zinc-700">Last Sync</th>
              <th className="text-right p-3 text-sm font-medium text-zinc-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-zinc-500">
                  Loading accounts...
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-zinc-500">
                  No bank accounts connected. Click "Connect Bank Account" to get started.
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr key={account.id} className="hover:bg-zinc-50">
                  <td className="p-3 text-sm text-zinc-900">{account.institutionName}</td>
                  <td className="p-3 text-sm text-zinc-900">
                    {account.accountName}
                    {account.mask && <span className="text-zinc-500"> ****{account.mask}</span>}
                  </td>
                  <td className="p-3 text-sm text-zinc-700 capitalize">
                    {account.subtype || account.type}
                  </td>
                  <td className="p-3 text-sm text-right text-zinc-900">
                    {account.balance !== null ? `$${account.balance.toFixed(2)}` : '-'}
                  </td>
                  <td className="p-3 text-sm text-zinc-700">
                    {account.lastSync || 'Never'}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSync(account.plaidItemId)}
                      >
                        Refresh
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect(account.plaidItemId, account.institutionName)}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
