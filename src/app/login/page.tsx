'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md space-y-8 px-4">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600">
            <Calculator className="h-7 w-7 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900">
            OpenLedger
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Sign in to your account
          </p>
        </div>

        {/* Login Form */}
        <div className="rounded-lg bg-white p-8 shadow-sm border border-zinc-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-zinc-700">
                Email address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium text-zinc-700">
                Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 border border-red-200">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 rounded-md bg-blue-50 p-4 border border-blue-200">
            <p className="text-xs font-medium text-blue-900 mb-2">Demo Credentials:</p>
            <p className="text-xs text-blue-700">Email: admin@example.com</p>
            <p className="text-xs text-blue-700">Password: password</p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-500">
          OpenLedger &copy; 2025. Modern accounting for modern businesses.
        </p>
      </div>
    </div>
  );
}
