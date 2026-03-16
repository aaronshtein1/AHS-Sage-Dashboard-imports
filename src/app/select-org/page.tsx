'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Building2, Check } from 'lucide-react';

export default function SelectOrgPage() {
  const { user, selectOrg, isLoading } = useAuth();
  const router = useRouter();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    // Redirect if not authenticated
    if (!isLoading && !user) {
      router.push('/login');
      return;
    }

    // Redirect if already has selected org
    if (user?.currentOrgId) {
      router.push('/');
      return;
    }

    // Redirect if only one org (shouldn't happen, but just in case)
    if (user?.orgs.length === 1) {
      handleSelect(user.orgs[0].id);
    }
  }, [user, isLoading, router]);

  const handleSelect = async (orgId: string) => {
    setIsSelecting(true);
    try {
      await selectOrg(orgId);
    } catch (error) {
      console.error('Failed to select organization:', error);
      setIsSelecting(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-zinc-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-zinc-900">Select Organization</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Welcome, {user.name}. Choose an organization to continue.
          </p>
        </div>

        {/* Organization Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {user.orgs.map((org) => {
            const isSelected = selectedOrgId === org.id;
            return (
              <Card
                key={org.id}
                className={`cursor-pointer border-2 p-6 transition-all hover:shadow-md ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-zinc-200 bg-white hover:border-emerald-300'
                }`}
                onClick={() => setSelectedOrgId(org.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`rounded-lg p-3 ${
                        isSelected ? 'bg-emerald-100' : 'bg-zinc-100'
                      }`}
                    >
                      <Building2
                        className={`h-6 w-6 ${
                          isSelected ? 'text-emerald-600' : 'text-zinc-600'
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900">{org.name}</h3>
                      <p className="mt-1 text-sm text-zinc-600 capitalize">{org.role}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="rounded-full bg-emerald-600 p-1">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Continue Button */}
        <div className="flex justify-center">
          <Button
            onClick={() => selectedOrgId && handleSelect(selectedOrgId)}
            disabled={!selectedOrgId || isSelecting}
            className="min-w-[200px] bg-emerald-600 hover:bg-emerald-700 text-white"
            size="lg"
          >
            {isSelecting ? 'Loading...' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
