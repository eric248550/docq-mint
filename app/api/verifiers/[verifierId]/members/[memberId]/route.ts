import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getVerifierMembership } from '@/lib/middleware/auth';
import { queryOne } from '@/lib/db/config';
import { DBVerifierMembership } from '@/lib/db/types';
import { getMemberRemovalError, getMemberUpdateError } from '@/lib/members/permissions';

const VALID_ROLES = ['owner', 'admin', 'viewer'];

async function countActiveOwners(verifierId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM docq_mint_verifier_memberships
     WHERE verifier_id = $1 AND role = 'owner' AND status = 'active'`,
    [verifierId]
  );
  return parseInt(row?.count || '0', 10);
}

async function getMember(memberId: string, verifierId: string) {
  return await queryOne<DBVerifierMembership>(
    'SELECT * FROM docq_mint_verifier_memberships WHERE id = $1 AND verifier_id = $2',
    [memberId, verifierId]
  );
}

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

    const actor = await getVerifierMembership(dbUser.id, verifierId);
    if (!actor || !['owner', 'admin'].includes(actor.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { role, status } = body;

    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const target = await getMember(memberId, verifierId);
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const ruleError = getMemberUpdateError({
      actor,
      target,
      nextRole: role,
      nextStatus: status,
      activeOwnerCount: await countActiveOwners(verifierId),
    });
    if (ruleError) {
      return NextResponse.json({ error: ruleError.error }, { status: ruleError.status });
    }

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

    const actor = await getVerifierMembership(dbUser.id, verifierId);
    if (!actor || !['owner', 'admin'].includes(actor.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const target = await getMember(memberId, verifierId);
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const ruleError = getMemberRemovalError({
      actor,
      target,
      activeOwnerCount: await countActiveOwners(verifierId),
    });
    if (ruleError) {
      return NextResponse.json({ error: ruleError.error }, { status: ruleError.status });
    }

    await queryOne(
      'DELETE FROM docq_mint_verifier_memberships WHERE id = $1 AND verifier_id = $2',
      [memberId, verifierId]
    );

    return NextResponse.json({ success: true });
  });
}
