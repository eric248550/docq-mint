import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { getWalletByOwnerIdAndRole, getWalletBalanceById } from '@/lib/wallet/cardano';

/**
 * GET /api/schools/[schoolId]/wallet
 * Get the issuer wallet (custody wallet) for a school
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { schoolId } = params;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check access - members should be able to view wallet info
    const hasAccess = await checkSchoolAccess(
      dbUser.id,
      schoolId,
      ['owner', 'admin', 'viewer']
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get the issuer wallet for this school
    const wallet = await getWalletByOwnerIdAndRole(schoolId, 'issuer');

    if (!wallet) {
      return NextResponse.json(
        { error: 'No issuer wallet found for this school' },
        { status: 404 }
      );
    }

    // Fetch balance using the wallet instance (from encrypted seed phrase)
    let balance = null;
    try {
      const lovelace = await getWalletBalanceById(wallet.id);
      balance = {
        lovelace,
        ada: (Number(lovelace) / 1_000_000).toFixed(6),
      };
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
      balance,
    });
  });
}

