'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { authenticatedRequest } from '@/lib/api/client';
import { DBCreditTransaction } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Coins, Loader2, AlertCircle } from 'lucide-react';

interface CreditBalanceInfoProps {
  schoolId: string;
}

interface CreditsResponse {
  balance: number;
  transactions: DBCreditTransaction[];
}

const TYPE_LABELS: Record<string, string> = {
  grant: 'Credit granted',
  debit: 'Document published',
  refund: 'Refund (mint failed)',
  adjustment: 'Adjustment',
};

export function CreditBalanceInfo({ schoolId }: CreditBalanceInfoProps) {
  const { getAuthToken } = useAuthStore();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<DBCreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) return;

    const response = await authenticatedRequest<CreditsResponse>(
      `/api/schools/${schoolId}/credits`,
      token
    );

    if (response.error || !response.data) {
      throw new Error(response.error || 'Failed to load credit balance');
    }

    setBalance(response.data.balance);
    setTransactions(response.data.transactions ?? []);
  }, [schoolId, getAuthToken]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        await fetchCredits();
      } catch (err) {
        if (active) {
          console.error('Failed to fetch credits:', err);
          setError('Failed to load credit balance');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchCredits]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchCredits();
    } catch (err) {
      console.error('Failed to refresh credits:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-6 bg-red-50 border-red-200">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-6 bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Coins className="h-4 w-4" />
              Publishing Credits
            </label>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
          <div className="p-4 bg-background border rounded-lg">
            <div className="text-3xl font-bold text-primary">
              {balance ?? 0} {balance === 1 ? 'Credit' : 'Credits'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Each published document uses 1 credit. Contact your administrator to add more.
            </p>
          </div>
        </div>

        {transactions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent activity</p>
            <ul className="divide-y rounded-lg border bg-background">
              {transactions.slice(0, 5).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    {TYPE_LABELS[tx.type] ?? tx.type}
                    {tx.note ? <span className="ml-1 text-xs">· {tx.note}</span> : null}
                  </span>
                  <span className={tx.amount >= 0 ? 'text-green-600 font-medium' : 'text-foreground font-medium'}>
                    {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
