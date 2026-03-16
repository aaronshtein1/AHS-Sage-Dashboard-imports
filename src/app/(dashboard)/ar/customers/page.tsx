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
import { Plus, Search, Pencil, Trash2, Users } from 'lucide-react';

interface Customer {
  id: string;
  customerCode: string;
  name: string;
  displayName?: string;
  email?: string;
  phone?: string;
  status: string;
  paymentTerms?: string;
  city?: string;
  state?: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [formData, setFormData] = useState({
    customerCode: '',
    name: '',
    displayName: '',
    email: '',
    phone: '',
    paymentTerms: '',
    addressLine1: '',
    city: '',
    state: '',
    zipCode: '',
  });

  useEffect(() => {
    loadCustomers();
  }, [searchQuery, statusFilter]);

  const loadCustomers = async () => {
    try {
      const query: any = {};
      if (searchQuery) query.search = searchQuery;
      if (statusFilter !== 'all') query.status = statusFilter;

      const result = await api.getCustomers(query);
      setCustomers(result.data || []);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, formData);
      } else {
        await api.createCustomer(formData);
      }
      setIsDialogOpen(false);
      setEditingCustomer(null);
      resetForm();
      loadCustomers();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save customer');
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      customerCode: customer.customerCode,
      name: customer.name,
      displayName: customer.displayName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      paymentTerms: customer.paymentTerms || '',
      addressLine1: '',
      city: customer.city || '',
      state: customer.state || '',
      zipCode: '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`Delete customer "${customer.name}"?`)) return;
    try {
      await api.deleteCustomer(customer.id);
      loadCustomers();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete customer');
    }
  };

  const resetForm = () => {
    setFormData({
      customerCode: '',
      name: '',
      displayName: '',
      email: '',
      phone: '',
      paymentTerms: '',
      addressLine1: '',
      city: '',
      state: '',
      zipCode: '',
    });
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Customers</h1>
          <p className="mt-1 text-sm text-zinc-600">Manage your customer contacts</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setEditingCustomer(null);
            setIsDialogOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Customers Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
        </div>
      ) : customers.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-zinc-300" />
          <p className="text-lg font-medium text-zinc-900">No customers found</p>
          <p className="text-sm text-zinc-500 mt-1">Create your first customer to get started</p>
        </Card>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.customerCode}</TableCell>
                  <TableCell>{customer.name}</TableCell>
                  <TableCell>{customer.email || '-'}</TableCell>
                  <TableCell>{customer.phone || '-'}</TableCell>
                  <TableCell>
                    {customer.city && customer.state
                      ? `${customer.city}, ${customer.state}`
                      : customer.city || customer.state || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        customer.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                      }
                    >
                      {customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(customer)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(customer)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Customer Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? 'Edit Customer' : 'New Customer'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Code</Label>
                <Input
                  value={formData.customerCode}
                  onChange={(e) => setFormData({ ...formData, customerCode: e.target.value })}
                  placeholder="Auto-generated if empty"
                />
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Select
                  value={formData.paymentTerms}
                  onValueChange={(value) => setFormData({ ...formData, paymentTerms: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select terms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NET15">Net 15</SelectItem>
                    <SelectItem value="NET30">Net 30</SelectItem>
                    <SelectItem value="NET45">Net 45</SelectItem>
                    <SelectItem value="NET60">Net 60</SelectItem>
                    <SelectItem value="DUE_ON_RECEIPT">Due on Receipt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Customer Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={formData.addressLine1}
                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>City</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
              <div>
                <Label>Zip</Label>
                <Input
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                {editingCustomer ? 'Save Changes' : 'Create Customer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
