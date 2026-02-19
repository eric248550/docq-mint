import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBSchool, DBSchoolMembership, DBUser } from '@/lib/db/types';
import { sendInviteEmail } from '@/lib/ses/send-invite';
import { generateInviteToken } from '@/lib/invite/token';

/**
 * GET /api/schools/:schoolId/members
 * List school members with pagination, filtering, and sorting
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

    const hasAccess = await checkSchoolAccess(
      dbUser.id,
      schoolId,
      ['owner', 'admin', 'viewer']
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = ['m.school_id = $1'];
    const qp: any[] = [schoolId];
    let idx = 2;

    if (role) {
      conditions.push(`m.role = $${idx++}`);
      qp.push(role);
    }
    if (search) {
      conditions.push(`COALESCE(u.email, m.invite_email) ILIKE $${idx++}`);
      qp.push(`%${search}%`);
    }

    const where = conditions.join(' AND ');

    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM docq_mint_school_memberships m
       LEFT JOIN docq_mint_users u ON u.id = m.user_id
       WHERE ${where}`,
      qp
    );
    const total = parseInt(countRow?.count || '0', 10);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const data = await query<DBSchoolMembership & { email: string | null }>(
      `SELECT m.*, u.email
       FROM docq_mint_school_memberships m
       LEFT JOIN docq_mint_users u ON u.id = m.user_id
       WHERE ${where}
       ORDER BY m.created_at ${sortOrder}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...qp, limit, offset]
    );

    return NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages },
    });
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

    // Validate the school exists
    const school = await queryOne<DBSchool>(
      'SELECT * FROM docq_mint_schools WHERE id = $1',
      [schoolId]
    );

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate role
    const validRoles = ['admin', 'viewer', 'student', 'parent'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Check if invite already exists for this email
    const existingInvite = await queryOne<DBSchoolMembership>(
      'SELECT * FROM docq_mint_school_memberships WHERE school_id = $1 AND invite_email = $2',
      [schoolId, email]
    );

    if (existingInvite) {
      return NextResponse.json({ error: 'An invite for this email already exists' }, { status: 400 });
    }

    // Check if user with this email already has an active membership
    const existingUser = await queryOne<DBUser>(
      'SELECT * FROM docq_mint_users WHERE email = $1',
      [email]
    );

    if (existingUser) {
      const existingMembership = await queryOne<DBSchoolMembership>(
        'SELECT * FROM docq_mint_school_memberships WHERE school_id = $1 AND user_id = $2',
        [schoolId, existingUser.id]
      );

      if (existingMembership) {
        return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
      }
    }

    // Create membership with 'invited' status — always requires explicit acceptance
    const membership = await queryOne<DBSchoolMembership>(
      `INSERT INTO docq_mint_school_memberships
       (school_id, user_id, invite_email, role, status)
       VALUES ($1, $2, $3, $4, 'invited')
       RETURNING *`,
      [schoolId, null, email, role]
    );

    // Generate JWT invite token and send email (fire-and-forget)
    const inviteToken = generateInviteToken({ schoolId, email, role });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteUrl = `${appUrl}/invite?token=${inviteToken}`;

    sendInviteEmail({
      to: email,
      schoolName: school.name,
      role,
      inviteUrl,
    }).catch((err) => {
      console.error('Failed to send invite email:', err);
    });

    return NextResponse.json({ membership }, { status: 201 });
  });
}
