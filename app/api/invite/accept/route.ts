import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { queryOne } from '@/lib/db/config';
import { DBSchoolMembership, DBVerifierMembership } from '@/lib/db/types';
import { verifyInviteToken } from '@/lib/invite/token';

/**
 * POST /api/invite/accept
 * Accept a membership invite using a JWT invite token.
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { dbUser, email } = authContext;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Missing invite token' }, { status: 400 });
    }

    const payload = verifyInviteToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired invite token' }, { status: 400 });
    }

    // Ensure the authenticated user's email matches the invite
    const userEmail = (dbUser.email || email || '').toLowerCase();
    if (!userEmail || userEmail !== payload.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invite was sent to a different email address' },
        { status: 403 }
      );
    }

    // Handle verifier invite
    if (payload.verifierId) {
      const verifierMembership = await queryOne<DBVerifierMembership>(
        `SELECT * FROM docq_mint_verifier_memberships
         WHERE verifier_id = $1 AND invite_email = $2 AND status = 'invited'`,
        [payload.verifierId, dbUser.email]
      );
      if (!verifierMembership) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
      }
      await queryOne(
        `UPDATE docq_mint_verifier_memberships SET user_id = $1, status = 'active' WHERE id = $2`,
        [dbUser.id, verifierMembership.id]
      );
      return NextResponse.json({ success: true });
    }

    // Look up the pending school membership
    const membership = await queryOne<DBSchoolMembership>(
      `SELECT * FROM docq_mint_school_memberships
       WHERE school_id = $1 AND invite_email = $2 AND status = 'invited'`,
      [payload.schoolId, payload.email]
    );

    if (!membership) {
      return NextResponse.json(
        { error: 'Invite not found or already accepted' },
        { status: 404 }
      );
    }

    // Activate the membership
    const updated = await queryOne<DBSchoolMembership>(
      `UPDATE docq_mint_school_memberships
       SET user_id = $1, status = 'active'
       WHERE id = $2
       RETURNING *`,
      [dbUser.id, membership.id]
    );

    return NextResponse.json({ membership: updated });
  });
}
