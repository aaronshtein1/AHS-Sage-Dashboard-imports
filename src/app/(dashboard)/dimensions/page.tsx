'use client';

import { Card } from '@/components/ui/card';
import { PencilRuler } from 'lucide-react';

export default function DimensionsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Dimensions</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage dimension types and values (Location, Department, Class, etc.)
        </p>
      </div>

      <Card className="p-12 text-center">
        <PencilRuler className="h-12 w-12 mx-auto text-zinc-400 mb-4" />
        <h3 className="text-lg font-medium text-zinc-900 mb-2">Coming Soon</h3>
        <p className="text-sm text-zinc-600">
          Dimension management functionality will be implemented by WS1
        </p>
      </Card>
    </div>
  );
}
