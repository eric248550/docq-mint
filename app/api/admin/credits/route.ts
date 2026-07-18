import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { query } from '@/lib/db/config';
import { grantCredits } from '@/lib/credits';
import { isAdminEmail } from '@/lib/auth/admin';

interface SchoolCreditRow {
  id: string;
  name: string;
  country_code: string | null;
  compliance_region: string | null;
  school_type: string | null;
  credit_balance: number;
  wallet_id: string | null;
  wallet_address: string | null;
  wallet_network: string | null;
  wallet_chain: string | null;
  owner_email: string | null;
  owner_status: string | null;
}

/**
 * GET /api/admin/credits
 * Admin-only: list all schools with their current credit balance,
 * custody wallet address (balance is fetched separately/on-demand from
 * the blockchain, see /api/admin/schools/balances), and owner email.
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { email: callerEmail } = authContext;

    if (!isAdminEmail(callerEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const schools = await query<SchoolCreditRow>(
      `SELECT
         s.id, s.name, s.country_code, s.compliance_region, s.credit_balance,
         s.school_type,
         w.id AS wallet_id, w.address AS wallet_address,
         w.network AS wallet_network, w.chain AS wallet_chain,
         owner.email AS owner_email, owner.status AS owner_status
       FROM docq_mint_schools s
       LEFT JOIN docq_mint_wallets w ON w.id = s.custody_wallet_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(u.email, m.invite_email) AS email, m.status
         FROM docq_mint_school_memberships m
         LEFT JOIN docq_mint_users u ON u.id = m.user_id
         WHERE m.school_id = s.id AND m.role = 'owner' AND m.status != 'removed'
         ORDER BY (m.status = 'active') DESC, m.created_at ASC
         LIMIT 1
       ) owner ON true
       ORDER BY s.name ASC`
    );

    return NextResponse.json({ schools });
  });
}

/**
 * POST /api/admin/credits
 * Admin-only: grant (or adjust) a school's credit balance.
 * Body: { schoolId: string, amount: number, note?: string, type?: 'grant' | 'adjustment' }
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { email: callerEmail, dbUser } = authContext;

    if (!isAdminEmail(callerEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId, amount, note, type } = body as {
      schoolId?: string;
      amount?: number;
      note?: string;
      type?: 'grant' | 'adjustment';
    };

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount === 0) {
      return NextResponse.json(
        { error: 'amount must be a non-zero integer' },
        { status: 400 }
      );
    }
    // 'grant' must be positive; use 'adjustment' for corrections (may be negative).
    const txType = type === 'adjustment' ? 'adjustment' : 'grant';
    if (txType === 'grant' && amount < 0) {
      return NextResponse.json(
        { error: 'Grant amount must be positive. Use type "adjustment" to remove credits.' },
        { status: 400 }
      );
    }

    try {
      const newBalance = await grantCredits({
        schoolId,
        amount,
        createdBy: dbUser?.id ?? null,
        note: note?.trim() || undefined,
        type: txType,
      });

      return NextResponse.json({ success: true, schoolId, balance: newBalance });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      // A negative adjustment below zero trips the credit_balance >= 0 CHECK.
      if (/violates check constraint|credit_balance/i.test(message)) {
        return NextResponse.json(
          { error: 'Adjustment would make the balance negative.' },
          { status: 400 }
        );
      }
      if (message === 'School not found') {
        return NextResponse.json({ error: 'School not found' }, { status: 404 });
      }
      console.error('Failed to grant credits:', error);
      return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 });
    }
  });
}
