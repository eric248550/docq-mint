import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getSchoolMembership } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBSchoolMembership } from '@/lib/db/types';
import { getMemberRemovalError, getMemberUpdateError } from '@/lib/members/permissions';

const VALID_ROLES = ['owner', 'admin', 'viewer', 'student', 'parent'];

async function countActiveOwners(schoolId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM docq_mint_school_memberships
     WHERE school_id = $1 AND role = 'owner' AND status = 'active'`,
    [schoolId]
  );
  return parseInt(row?.count || '0', 10);
}

async function getMember(memberId: string, schoolId: string) {
  return await queryOne<DBSchoolMembership>(
    'SELECT * FROM docq_mint_school_memberships WHERE id = $1 AND school_id = $2',
    [memberId, schoolId]
  );
}

/**
 * PATCH /api/schools/:schoolId/members/:memberId
 * Update member role or remove them
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { schoolId: string; memberId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { schoolId, memberId } = params;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const actor = await getSchoolMembership(dbUser.id, schoolId);
    if (!actor || !['owner', 'admin'].includes(actor.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { role, status } = body;

    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const target = await getMember(memberId, schoolId);
    if (!target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const ruleError = getMemberUpdateError({
      actor,
      target,
      nextRole: role,
      nextStatus: status,
      activeOwnerCount: await countActiveOwners(schoolId),
    });
    if (ruleError) {
      return NextResponse.json({ error: ruleError.error }, { status: ruleError.status });
    }

    const membership = await queryOne<DBSchoolMembership>(
      `UPDATE docq_mint_school_memberships
       SET role = COALESCE($1, role),
           status = COALESCE($2, status)
       WHERE id = $3 AND school_id = $4
       RETURNING *`,
      [role || null, status || null, memberId, schoolId]
    );

    if (!membership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json({ membership });
  });
}

/**
 * DELETE /api/schools/:schoolId/members/:memberId
 * Remove member from school
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string; memberId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { schoolId, memberId } = params;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const actor = await getSchoolMembership(dbUser.id, schoolId);
    if (!actor || !['owner', 'admin'].includes(actor.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const target = await getMember(memberId, schoolId);
    if (!target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const ruleError = getMemberRemovalError({
      actor,
      target,
      activeOwnerCount: await countActiveOwners(schoolId),
    });
    if (ruleError) {
      return NextResponse.json({ error: ruleError.error }, { status: ruleError.status });
    }

    await query(
      'DELETE FROM docq_mint_school_memberships WHERE id = $1 AND school_id = $2',
      [memberId, schoolId]
    );

    return NextResponse.json({ success: true });
  });
}
