'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { Landmark, Loader2 } from 'lucide-react';

interface PlaidLinkButtonProps {
  onSuccess: () => void;
  onError?: (error: string) => void;
}

export function PlaidLinkButton({ onSuccess, onError }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(false);

  // Fetch link token on mount
  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        setLoading(true);
        const response = await api.createPlaidLinkToken();
        setLinkToken(response.linkToken);
      } catch (error) {
        console.error('Failed to create link token:', error);
        onError?.('Failed to initialize bank connection');
      } finally {
        setLoading(false);
      }
    };

    fetchLinkToken();
  }, [onError]);

  const handleSuccess = useCallback(
    async (publicToken: string) => {
      try {
        setExchanging(true);
        await api.exchangePlaidPublicToken(publicToken);
        onSuccess();
      } catch (error) {
        console.error('Failed to exchange token:', error);
        onError?.('Failed to link bank account');
      } finally {
        setExchanging(false);
      }
    },
    [onSuccess, onError]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token) => handleSuccess(public_token),
    onExit: (error) => {
      if (error) {
        console.error('Plaid Link exit error:', error);
        onError?.(error.display_message || 'Connection cancelled');
      }
    },
  });

  const isDisabled = !ready || loading || exchanging;

  return (
    <Button
      onClick={() => open()}
      disabled={isDisabled}
      size="lg"
      className="gap-2"
    >
      {loading || exchanging ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {exchanging ? 'Connecting...' : 'Initializing...'}
        </>
      ) : (
        <>
          <Landmark className="h-4 w-4" />
          Connect Bank Account
        </>
      )}
    </Button>
  );
}
