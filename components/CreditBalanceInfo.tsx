'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { authenticatedRequest } from '@/lib/api/client';
import { DBCreditTransaction } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Coins, Loader2, AlertCircle, ChevronDown, RefreshCw } from 'lucide-react';

interface CreditBalanceInfoProps {
  schoolId: string;
}

interface CreditsResponse {
  balance: number;
  transactions: DBCreditTransaction[];
}

function formatDate(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const [activityOpen, setActivityOpen] = useState(false);

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
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh"
              title="Refresh"
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
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
            <button
              type="button"
              onClick={() => setActivityOpen((v) => !v)}
              aria-expanded={activityOpen}
              className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Recent activity</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${activityOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {activityOpen && (
              <ul className="mt-2 divide-y rounded-lg border bg-background">
                {transactions.slice(0, 10).map((tx) => (
                  <li key={tx.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="text-foreground">{TYPE_LABELS[tx.type] ?? tx.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.created_at)}
                        {tx.note ? ` · ${tx.note}` : ''}
                      </p>
                    </div>
                    <span
                      className={
                        tx.amount >= 0
                          ? 'shrink-0 text-green-600 font-medium'
                          : 'shrink-0 text-foreground font-medium'
                      }
                    >
                      {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
