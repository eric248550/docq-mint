import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBSchoolMembership } from '@/lib/db/types';

/**
 * PATCH /api/schools/:schoolId/members/:memberId
 * Update member role or status
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

    // Check access - only owner/admin can update
    const hasAccess = await checkSchoolAccess(dbUser.id, schoolId, ['owner', 'admin']);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { role, status } = body;

    // Validate role if provided
    if (role) {
      const validRoles = ['owner', 'admin', 'viewer', 'student', 'parent'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ['active', 'invited', 'removed'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
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

    // Check access - only owner/admin can remove
    const hasAccess = await checkSchoolAccess(dbUser.id, schoolId, ['owner', 'admin']);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if trying to remove the last owner
    const membership = await queryOne<DBSchoolMembership>(
      'SELECT * FROM docq_mint_school_memberships WHERE id = $1 AND school_id = $2',
      [memberId, schoolId]
    );

    if (membership?.role === 'owner') {
      const ownerCount = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM docq_mint_school_memberships 
         WHERE school_id = $1 AND role = 'owner' AND status = 'active'`,
        [schoolId]
      );

      if (ownerCount && parseInt(ownerCount.count) <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last owner' },
          { status: 400 }
        );
      }
    }

    await query(
      'DELETE FROM docq_mint_school_memberships WHERE id = $1 AND school_id = $2',
      [memberId, schoolId]
    );

    return NextResponse.json({ success: true });
  });
}

