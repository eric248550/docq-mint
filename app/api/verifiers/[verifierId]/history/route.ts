import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/config';
import { withAuth } from '@/lib/middleware/auth';
import { checkVerifierAccess } from '@/lib/middleware/auth';
import { DBPayment, DBVerificationAccess } from '@/lib/db/types';

/**
 * GET /api/verifiers/:verifierId/history
 * Returns payments and verification access records for the verifier org
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { verifierId: string } }
) {
  return withAuth(request, async ({ dbUser }) => {
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { verifierId } = params;

    const hasAccess = await checkVerifierAccess(dbUser.id, verifierId, ['owner', 'admin', 'viewer']);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payments = await query<DBPayment>(
      `SELECT * FROM docq_mint_payments
       WHERE verifier_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [verifierId]
    );

    const accessRecords = await query<DBVerificationAccess & { token: string; original_filename: string | null; document_type: string }>(
      `SELECT va.*, vt.token, d.original_filename, d.document_type
       FROM docq_mint_verification_access va
       JOIN docq_mint_verification_tokens vt ON vt.id = va.token_id
       JOIN docq_mint_documents d ON d.id = vt.document_id
       WHERE va.verifier_id = $1
       ORDER BY va.created_at DESC
       LIMIT 50`,
      [verifierId]
    );

    return NextResponse.json({ payments, accessRecords });
  });
}
