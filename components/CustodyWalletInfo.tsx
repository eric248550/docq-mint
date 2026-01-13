'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { authenticatedRequest } from '@/lib/api/client';
import { DBWallet } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Wallet, Copy, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

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
  const [copied, setCopied] = useState(false);
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

  const handleCopyAddress = async () => {
    if (!wallet?.address) return;

    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
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
            <h3 className="font-semibold text-lg mb-1">Custody Wallet</h3>
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
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Custody Wallet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {wallet.network} • {wallet.wallet_role}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Wallet Address */}
        <div>
          <label className="text-sm font-medium text-muted-foreground block mb-2">
            Wallet Address
          </label>
          <div className="flex items-center gap-2 p-3 bg-background border rounded-lg">
            <code className="text-sm flex-1 break-all font-mono">
              {wallet.address}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAddress}
              className="shrink-0"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>

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
                  ₳ {balance.ada}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {balance.lovelace} lovelace
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

        {/* Help Text */}
        <div className="text-xs text-muted-foreground bg-background/50 p-3 rounded-md">
          💡 <strong>Tip:</strong> Copy the wallet address above to send ADA to this custody wallet. 
          The organization uses this wallet to mint and manage NFTs for documents.
        </div>
      </div>
    </div>
  );
}

