import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBSchoolMembership, DBUser } from '@/lib/db/types';

/**
 * GET /api/schools/:schoolId/members
 * List school members
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

    // Check access
    const hasAccess = await checkSchoolAccess(
      dbUser.id,
      schoolId,
      ['owner', 'admin', 'viewer']
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get members with user details
    const members = await query<DBSchoolMembership & { email: string | null }>(
      `SELECT m.*, u.email
       FROM docq_mint_school_memberships m
       LEFT JOIN docq_mint_users u ON u.id = m.user_id
       WHERE m.school_id = $1
       ORDER BY 
         CASE m.role
           WHEN 'owner' THEN 1
           WHEN 'admin' THEN 2
           WHEN 'viewer' THEN 3
           WHEN 'student' THEN 4
           WHEN 'parent' THEN 5
         END,
         m.created_at DESC`,
      [schoolId]
    );

    return NextResponse.json({ members });
  });
}

/**
 * POST /api/schools/:schoolId/members
 * Invite a member (student or admin)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { schoolId } = params;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check access - only owner/admin can invite
    const hasAccess = await checkSchoolAccess(dbUser.id, schoolId, ['owner', 'admin']);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { email, role } = body;

    // Validate role
    const validRoles = ['admin', 'viewer', 'student', 'parent'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Check if user exists by email
    const existingUser = email ? await queryOne<DBUser>(
      'SELECT * FROM docq_mint_users WHERE email = $1',
      [email]
    ) : null;

    // Check if already a member
    if (existingUser) {
      const existingMembership = await queryOne<DBSchoolMembership>(
        'SELECT * FROM docq_mint_school_memberships WHERE school_id = $1 AND user_id = $2',
        [schoolId, existingUser.id]
      );

      if (existingMembership) {
        return NextResponse.json(
          { error: 'User is already a member' },
          { status: 400 }
        );
      }
    }

    // Create membership
    const membership = await queryOne<DBSchoolMembership>(
      `INSERT INTO docq_mint_school_memberships 
       (school_id, user_id, invite_email, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        schoolId,
        existingUser?.id || null,
        email || null,
        role,
        existingUser ? 'active' : 'invited'
      ]
    );

    return NextResponse.json({ membership }, { status: 201 });
  });
}

