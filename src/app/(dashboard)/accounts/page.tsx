'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Account, CreateAccountRequest, DimensionType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit } from 'lucide-react';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dimensionTypes, setDimensionTypes] = useState<DimensionType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [accountsData, dimensionsData] = await Promise.all([
        api.getAccounts().catch(() => []),
        api.getDimensionTypes().catch(() => []),
      ]);
      setAccounts(accountsData);
      setDimensionTypes(dimensionsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      setAccounts([]);
      setDimensionTypes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingAccount(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setIsDialogOpen(true);
  };

  const handleSave = async (account: Account) => {
    setAccounts((prev) =>
      editingAccount
        ? prev.map((a) => (a.id === account.id ? account : a))
        : [...prev, account]
    );
    setIsDialogOpen(false);
    setEditingAccount(null);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Chart of Accounts
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Manage general ledger accounts
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={handleAdd}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <AccountDialog
            account={editingAccount}
            dimensionTypes={dimensionTypes}
            onSave={handleSave}
            onCancel={() => setIsDialogOpen(false)}
          />
        </Dialog>
      </div>

      {/* Accounts Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Normal Balance</TableHead>
                <TableHead>Required Dimensions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.accountCode}</TableCell>
                  <TableCell>{account.title}</TableCell>
                  <TableCell className="capitalize">{account.accountType?.toLowerCase()}</TableCell>
                  <TableCell className="capitalize">{account.normalBalance?.toLowerCase()}</TableCell>
                  <TableCell>
                    {account.requiredDimensions && account.requiredDimensions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {account.requiredDimensions.map((dim) => (
                          <Badge key={dim.dimensionType.code} variant="outline" className="text-xs">
                            {dim.dimensionType.name}
                          </Badge>
                        ))}
                      </div>
                    ) : account.requireDepartment || account.requireLocation ? (
                      <div className="flex flex-wrap gap-1">
                        {account.requireDepartment && (
                          <Badge variant="outline" className="text-xs">Department</Badge>
                        )}
                        {account.requireLocation && (
                          <Badge variant="outline" className="text-xs">Location</Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-400 text-sm">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        account.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                      }
                    >
                      {account.status?.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(account)}
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function AccountDialog({
  account,
  dimensionTypes,
  onSave,
  onCancel,
}: {
  account: Account | null;
  dimensionTypes: DimensionType[];
  onSave: (account: Account) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<CreateAccountRequest>({
    accountCode: account?.accountCode || '',
    title: account?.title || '',
    accountType: account?.accountType || 'ASSET',
    normalBalance: account?.normalBalance || 'DEBIT',
    closingType: account?.closingType || 'NON_CLOSING',
    category: account?.category || '',
    requiredDimensionTypeIds: account?.requiredDimensions?.map(d => d.dimensionType.id) || [],
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const savedAccount = account
        ? await api.updateAccount(account.id, formData)
        : await api.createAccount(formData);
      onSave(savedAccount);
    } catch (error) {
      console.error('Failed to save account:', error);
      alert(error instanceof Error ? error.message : 'Failed to save account');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDimension = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      requiredDimensionTypeIds: prev.requiredDimensionTypeIds?.includes(id)
        ? prev.requiredDimensionTypeIds.filter((d) => d !== id)
        : [...(prev.requiredDimensionTypeIds || []), id],
    }));
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {account ? 'Edit Account' : 'New Account'}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="accountCode">
              Account Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="accountCode"
              required
              value={formData.accountCode}
              onChange={(e) =>
                setFormData({ ...formData, accountCode: e.target.value })
              }
              placeholder="1001"
            />
          </div>

          <div>
            <Label htmlFor="title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Cash - Operating"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="accountType">
              Account Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.accountType}
              onValueChange={(value: any) =>
                setFormData({ ...formData, accountType: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASSET">Asset</SelectItem>
                <SelectItem value="LIABILITY">Liability</SelectItem>
                <SelectItem value="EQUITY">Equity</SelectItem>
                <SelectItem value="REVENUE">Revenue</SelectItem>
                <SelectItem value="EXPENSE">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="normalBalance">
              Normal Balance <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.normalBalance}
              onValueChange={(value: any) =>
                setFormData({ ...formData, normalBalance: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEBIT">Debit</SelectItem>
                <SelectItem value="CREDIT">Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="closingType">
              Period End Closing Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.closingType}
              onValueChange={(value: any) =>
                setFormData({ ...formData, closingType: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NON_CLOSING">Non-closing Account</SelectItem>
                <SelectItem value="CLOSING">Closing Account</SelectItem>
                <SelectItem value="CLOSED_TO">Closed To Account</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={formData.category || ''}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              placeholder="Current Assets"
            />
          </div>
        </div>

        <div>
          <Label className="mb-3 block">Required Dimensions</Label>
          <div className="space-y-2 rounded-lg border border-zinc-200 p-4">
            {dimensionTypes.map((dimType) => (
              <div key={dimType.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`dim-${dimType.id}`}
                  checked={formData.requiredDimensionTypeIds?.includes(dimType.id)}
                  onCheckedChange={() => toggleDimension(dimType.id)}
                />
                <label
                  htmlFor={`dim-${dimType.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {dimType.name}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving ? 'Saving...' : account ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
