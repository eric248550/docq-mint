import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBCreditTransaction } from '@/lib/db/types';

/**
 * GET /api/schools/[schoolId]/credits
 * Return the school's current credit balance and recent ledger history.
 * Members (owner/admin/viewer) can view; this replaces exposing the raw
 * custody-wallet ADA balance to org users.
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

    const hasAccess = await checkSchoolAccess(dbUser.id, schoolId, ['owner', 'admin', 'viewer']);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const school = await queryOne<{ credit_balance: number }>(
      'SELECT credit_balance FROM docq_mint_schools WHERE id = $1',
      [schoolId]
    );

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const transactions = await query<DBCreditTransaction>(
      `SELECT * FROM docq_mint_credit_transactions
       WHERE school_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [schoolId]
    );

    return NextResponse.json({
      balance: school.credit_balance,
      transactions,
    });
  });
}
