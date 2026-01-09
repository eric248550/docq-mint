import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { getWalletByOwnerId, getWalletBalance } from '@/lib/wallet/cardano';

/**
 * GET /api/wallets/[ownerId]
 * Get wallet information for a user or school
 * Query params:
 *  - refresh: if true, fetch fresh balance from blockchain
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { ownerId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { ownerId } = params;
    const { searchParams } = new URL(request.url);
    const shouldRefresh = searchParams.get('refresh') === 'true';

    // TODO: Add authorization check to ensure user has access to this wallet
    // For now, we'll allow users to query their own wallet or school wallets they're members of

    const wallet = await getWalletByOwnerId(ownerId);

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    // Fetch balance if requested or by default
    let balance = null;
    try {
      balance = await getWalletBalance(wallet.address, wallet.network as 'mainnet' | 'preprod');
    } catch (error) {
      console.error('Failed to fetch wallet balance:', error);
      // Continue without balance rather than failing the entire request
    }

    // Return wallet info without sensitive data (encrypted seed phrase)
    return NextResponse.json({
      wallet: {
        id: wallet.id,
        chain: wallet.chain,
        address: wallet.address,
        stake_address: wallet.stake_address,
        wallet_role: wallet.wallet_role,
        network: wallet.network,
        owner_id: wallet.owner_id,
        created_at: wallet.created_at,
      },
      balance: balance ? {
        lovelace: balance.toString(),
        ada: (Number(balance) / 1_000_000).toFixed(6),
      } : null,
    });
  });
}

