import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { query } from '@/lib/db/config';
import { getCachedWalletBalance, mapWithConcurrency, CachedWalletBalance } from '@/lib/wallet/cardano';
import { isAdminEmail } from '@/lib/auth/admin';

interface SchoolWalletRow {
  school_id: string;
  wallet_id: string | null;
  address: string | null;
  network: string | null;
  cached_balance_lovelace: string | null;
  balance_checked_at: Date | null;
}

const MAX_BATCH_SIZE = 50;
const BLOCKFROST_CONCURRENCY = 5;

/**
 * POST /api/admin/schools/balances
 * Admin-only: batch-fetch custody wallet balances for a set of schools.
 * Serves from the DB-cached balance when fresh (see getCachedWalletBalance),
 * only hitting Blockfrost for wallets whose cache is stale or missing.
 * Body: { schoolIds: string[], force?: boolean }
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { email: callerEmail } = authContext;

    if (!isAdminEmail(callerEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolIds, force } = body as { schoolIds?: string[]; force?: boolean };

    if (!Array.isArray(schoolIds) || schoolIds.length === 0) {
      return NextResponse.json({ error: 'schoolIds is required' }, { status: 400 });
    }

    const ids = schoolIds.slice(0, MAX_BATCH_SIZE);

    const rows = await query<SchoolWalletRow>(
      `SELECT
         s.id AS school_id, w.id AS wallet_id, w.address, w.network,
         w.cached_balance_lovelace, w.balance_checked_at
       FROM docq_mint_schools s
       LEFT JOIN docq_mint_wallets w ON w.id = s.custody_wallet_id
       WHERE s.id = ANY($1::uuid[])`,
      [ids]
    );

    const entries = await mapWithConcurrency(rows, BLOCKFROST_CONCURRENCY, async (row) => {
      if (!row.wallet_id || !row.address || !row.network) {
        return [row.school_id, null] as [string, CachedWalletBalance | null];
      }
      try {
        const balance = await getCachedWalletBalance(
          {
            id: row.wallet_id,
            address: row.address,
            network: row.network,
            cached_balance_lovelace: row.cached_balance_lovelace,
            balance_checked_at: row.balance_checked_at,
          },
          { forceRefresh: !!force }
        );
        return [row.school_id, balance] as [string, CachedWalletBalance | null];
      } catch (error) {
        console.error(`Failed to get balance for school ${row.school_id}:`, error);
        return [row.school_id, null] as [string, CachedWalletBalance | null];
      }
    });

    const balances: Record<string, CachedWalletBalance | null> = {};
    for (const [schoolId, balance] of entries) {
      balances[schoolId] = balance;
    }

    return NextResponse.json({ balances });
  });
}
