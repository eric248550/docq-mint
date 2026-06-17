'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { authenticatedRequest } from '@/lib/api/client';
import { DBWallet } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Wallet, Loader2, AlertCircle } from 'lucide-react';

interface CustodyWalletInfoProps {
  schoolId: string;
}

interface WalletBalance {
  lovelace: string;
  ada: string;
}

export function CustodyWalletInfo({ schoolId }: CustodyWalletInfoProps) {
  const { getAuthToken } = useAuthStore();
  const [wallet, setWallet] = useState<DBWallet | null>(null);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWalletInfo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const token = await getAuthToken();
        if (!token) return;

        // Fetch the issuer wallet for this school
        const walletResponse = await authenticatedRequest<{ 
          wallet: DBWallet;
          balance?: WalletBalance;
        }>(
          `/api/schools/${schoolId}/wallet`,
          token
        );

        if (walletResponse.data?.wallet) {
          setWallet(walletResponse.data.wallet);
          if (walletResponse.data.balance) {
            setBalance(walletResponse.data.balance);
          }
        }
      } catch (error) {
        console.error('Failed to fetch wallet info:', error);
        setError('Failed to load wallet information');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWalletInfo();
  }, [schoolId, getAuthToken]);

  const handleRefreshBalance = async () => {
    if (!wallet) return;

    try {
      setIsLoadingBalance(true);
      const token = await getAuthToken();
      if (!token) return;

      const response = await authenticatedRequest<{ 
        wallet: DBWallet;
        balance?: WalletBalance;
      }>(
        `/api/schools/${schoolId}/wallet`,
        token
      );

      if (response.data?.balance) {
        setBalance(response.data.balance);
      }
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    } finally {
      setIsLoadingBalance(false);
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

  if (!wallet) {
    return (
      <div className="border rounded-lg p-6 bg-muted">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-background rounded-lg">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              No issuer wallet configured for this school.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-6 bg-gradient-to-br from-primary/5 to-primary/10">

      <div className="space-y-4">
        {/* Balance */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-muted-foreground">
              Balance
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshBalance}
              disabled={isLoadingBalance}
            >
              {isLoadingBalance ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Refresh'
              )}
            </Button>
          </div>
          <div className="p-4 bg-background border rounded-lg">
            {balance ? (
              <div>
                <div className="text-3xl font-bold text-primary">
                  {parseFloat(balance.ada).toFixed(2)} Credit
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">
                <p className="text-sm">Balance not available</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleRefreshBalance}
                  className="p-0 h-auto mt-1"
                >
                  Click to fetch balance
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

