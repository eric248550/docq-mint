import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkVerifierAccess } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBVerifier, DBVerifierMembership, DBUser } from '@/lib/db/types';
import { sendInviteEmail } from '@/lib/ses/send-invite';
import { generateInviteToken } from '@/lib/invite/token';

/**
 * GET /api/verifiers/:verifierId/members
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { verifierId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { verifierId } = params;
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const hasAccess = await checkVerifierAccess(dbUser.id, verifierId, ['owner', 'admin', 'viewer']);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = ['m.verifier_id = $1'];
    const qp: any[] = [verifierId];
    let idx = 2;

    if (role) { conditions.push(`m.role = $${idx++}`); qp.push(role); }
    if (search) {
      conditions.push(`COALESCE(u.email, m.invite_email) ILIKE $${idx++}`);
      qp.push(`%${search}%`);
    }

    const where = conditions.join(' AND ');

    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM docq_mint_verifier_memberships m
       LEFT JOIN docq_mint_users u ON u.id = m.user_id
       WHERE ${where}`,
      qp
    );
    const total = parseInt(countRow?.count || '0', 10);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const data = await query<DBVerifierMembership & { email: string | null }>(
      `SELECT m.*, u.email
       FROM docq_mint_verifier_memberships m
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
 * POST /api/verifiers/:verifierId/members
 * Invite a member to the verifier org
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { verifierId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { verifierId } = params;
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const hasAccess = await checkVerifierAccess(dbUser.id, verifierId, ['owner', 'admin']);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const verifier = await queryOne<DBVerifier>(
      'SELECT * FROM docq_mint_verifiers WHERE id = $1',
      [verifierId]
    );
    if (!verifier) return NextResponse.json({ error: 'Verifier not found' }, { status: 404 });

    const body = await request.json();
    const { email, role } = body;

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const validRoles = ['admin', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be admin or viewer' }, { status: 400 });
    }

    const existingInvite = await queryOne<DBVerifierMembership>(
      'SELECT * FROM docq_mint_verifier_memberships WHERE verifier_id = $1 AND invite_email = $2',
      [verifierId, email]
    );
    if (existingInvite) {
      return NextResponse.json({ error: 'An invite for this email already exists' }, { status: 400 });
    }

    const existingUser = await queryOne<DBUser>(
      'SELECT * FROM docq_mint_users WHERE email = $1',
      [email]
    );
    if (existingUser) {
      const existingMembership = await queryOne<DBVerifierMembership>(
        'SELECT * FROM docq_mint_verifier_memberships WHERE verifier_id = $1 AND user_id = $2',
        [verifierId, existingUser.id]
      );
      if (existingMembership) {
        return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
      }
    }

    const membership = await queryOne<DBVerifierMembership>(
      `INSERT INTO docq_mint_verifier_memberships
       (verifier_id, user_id, invite_email, role, status)
       VALUES ($1, $2, $3, $4, 'invited')
       RETURNING *`,
      [verifierId, null, email, role]
    );

    const inviteToken = generateInviteToken({ verifierId, email, role });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteUrl = `${appUrl}/invite?token=${inviteToken}`;

    sendInviteEmail({
      to: email,
      schoolName: verifier.name,
      role,
      inviteUrl,
    }).catch((err) => {
      console.error('Failed to send invite email:', err);
    });

    return NextResponse.json({ membership }, { status: 201 });
  });
}
