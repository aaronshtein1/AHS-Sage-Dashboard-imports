'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, FileText, Pencil, Trash2, Send, DollarSign } from 'lucide-react';
import type { Account } from '@/types';

interface Bill {
  id: string;
  billNumber: string;
  vendorInvoiceNo?: string;
  billDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  status: string;
  vendor: { id: string; name: string; vendorCode: string };
}

interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');

  const [formData, setFormData] = useState({
    vendorId: '',
    vendorInvoiceNo: '',
    billDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    description: '',
    apAccountId: '',
    lines: [{ accountId: '', description: '', quantity: 1, unitPrice: 0, amount: 0 }],
  });

  useEffect(() => {
    loadData();
  }, [statusFilter, vendorFilter]);

  const loadData = async () => {
    try {
      const [billsResult, vendorsResult, accountsResult] = await Promise.all([
        api.getBills({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          vendorId: vendorFilter !== 'all' ? vendorFilter : undefined,
        }),
        api.getVendors({ status: 'ACTIVE' }),
        api.getAccounts(),
      ]);
      setBills(billsResult.data || []);
      setVendors(vendorsResult.data || []);
      setAccounts(accountsResult || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createBill(formData);
      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save bill');
    }
  };

  const handlePost = async (billId: string) => {
    if (!confirm('Post this bill? This will record it in the ledger.')) return;
    try {
      await api.postBill(billId);
      loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to post bill');
    }
  };

  const handleDelete = async (bill: Bill) => {
    if (!confirm(`Delete bill "${bill.billNumber}"?`)) return;
    try {
      await api.deleteBill(bill.id);
      loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete bill');
    }
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { accountId: '', description: '', quantity: 1, unitPrice: 0, amount: 0 }],
    });
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      newLines[index].amount = newLines[index].quantity * newLines[index].unitPrice;
    }
    setFormData({ ...formData, lines: newLines });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length <= 1) return;
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index),
    });
  };

  const resetForm = () => {
    setFormData({
      vendorId: '',
      vendorInvoiceNo: '',
      billDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      description: '',
      apAccountId: '',
      lines: [{ accountId: '', description: '', quantity: 1, unitPrice: 0, amount: 0 }],
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-zinc-50 text-zinc-600 border-zinc-200',
      POSTED: 'bg-blue-50 text-blue-700 border-blue-200',
      PARTIALLY_PAID: 'bg-amber-50 text-amber-700 border-amber-200',
      PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      CANCELLED: 'bg-red-50 text-red-700 border-red-200',
    };
    return styles[status] || styles.DRAFT;
  };

  const apAccounts = accounts.filter((a) => a.accountType === 'LIABILITY');
  const expenseAccounts = accounts.filter((a) => a.accountType === 'EXPENSE' || a.accountType === 'ASSET');

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Bills</h1>
          <p className="mt-1 text-sm text-zinc-600">Manage vendor bills and payments</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Bill
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <Select value={vendorFilter} onValueChange={setVendorFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="POSTED">Posted</SelectItem>
            <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bills Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
        </div>
      ) : bills.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-zinc-300" />
          <p className="text-lg font-medium text-zinc-900">No bills found</p>
          <p className="text-sm text-zinc-500 mt-1">Create a new bill to get started</p>
        </Card>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Bill Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-medium">{bill.billNumber}</TableCell>
                  <TableCell>{bill.vendor.name}</TableCell>
                  <TableCell>{new Date(bill.billDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(bill.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(bill.totalAmount))}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(bill.totalAmount) - Number(bill.amountPaid))}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusBadge(bill.status)}>
                      {bill.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {bill.status === 'DRAFT' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePost(bill.id)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(bill)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {(bill.status === 'POSTED' || bill.status === 'PARTIALLY_PAID') && (
                        <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700">
                          <DollarSign className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* New Bill Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Bill</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vendor *</Label>
                <Select
                  value={formData.vendorId}
                  onValueChange={(value) => setFormData({ ...formData, vendorId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vendor Invoice #</Label>
                <Input
                  value={formData.vendorInvoiceNo}
                  onChange={(e) => setFormData({ ...formData, vendorInvoiceNo: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Bill Date *</Label>
                <Input
                  type="date"
                  value={formData.billDate}
                  onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>AP Account *</Label>
                <Select
                  value={formData.apAccountId}
                  onValueChange={(value) => setFormData({ ...formData, apAccountId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select AP account" />
                  </SelectTrigger>
                  <SelectContent>
                    {apAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.accountCode} - {a.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
              </div>
              <div className="border rounded-lg p-4 space-y-3">
                {formData.lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <Label className="text-xs">Account</Label>
                      <Select
                        value={line.accountId}
                        onValueChange={(value) => updateLine(index, 'accountId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {expenseAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.accountCode} - {a.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                      />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        value={line.amount.toFixed(2)}
                        disabled
                        className="bg-zinc-50"
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(index)}
                        disabled={formData.lines.length <= 1}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="text-right pt-2 border-t">
                  <span className="font-medium">
                    Total: {formatCurrency(formData.lines.reduce((sum, l) => sum + l.amount, 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                Create Bill
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
