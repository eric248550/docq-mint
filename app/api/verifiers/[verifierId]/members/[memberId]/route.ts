import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkVerifierAccess } from '@/lib/middleware/auth';
import { queryOne } from '@/lib/db/config';
import { DBVerifierMembership } from '@/lib/db/types';

/**
 * PATCH /api/verifiers/:verifierId/members/:memberId
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { verifierId: string; memberId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { verifierId, memberId } = params;
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const hasAccess = await checkVerifierAccess(dbUser.id, verifierId, ['owner', 'admin']);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const body = await request.json();
    const { role, status } = body;

    const membership = await queryOne<DBVerifierMembership>(
      `UPDATE docq_mint_verifier_memberships
       SET role = COALESCE($1, role), status = COALESCE($2, status)
       WHERE id = $3 AND verifier_id = $4
       RETURNING *`,
      [role || null, status || null, memberId, verifierId]
    );

    if (!membership) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    return NextResponse.json({ membership });
  });
}

/**
 * DELETE /api/verifiers/:verifierId/members/:memberId
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { verifierId: string; memberId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { verifierId, memberId } = params;
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const hasAccess = await checkVerifierAccess(dbUser.id, verifierId, ['owner', 'admin']);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // Prevent removing the last owner
    const membership = await queryOne<DBVerifierMembership>(
      'SELECT * FROM docq_mint_verifier_memberships WHERE id = $1 AND verifier_id = $2',
      [memberId, verifierId]
    );
    if (!membership) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    if (membership.role === 'owner') {
      const ownerCount = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM docq_mint_verifier_memberships
         WHERE verifier_id = $1 AND role = 'owner' AND status = 'active'`,
        [verifierId]
      );
      if (parseInt(ownerCount?.count || '0', 10) <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last owner' }, { status: 400 });
      }
    }

    await queryOne(
      'DELETE FROM docq_mint_verifier_memberships WHERE id = $1',
      [memberId]
    );

    return NextResponse.json({ success: true });
  });
}
