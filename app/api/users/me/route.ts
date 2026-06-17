import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBSchoolMembership, DBVerifierMembership } from '@/lib/db/types';

/**
 * GET /api/users/me
 * Get current user profile with memberships
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's school memberships with school details
    const memberships = await query<DBSchoolMembership & { school_name: string }>(
      `SELECT m.*, s.name as school_name
       FROM docq_mint_school_memberships m
       JOIN docq_mint_schools s ON s.id = m.school_id
       WHERE m.user_id = $1 AND m.status = 'active'
       ORDER BY m.created_at DESC`,
      [dbUser.id]
    );

    // Get user's verifier memberships
    const verifierMemberships = await query<DBVerifierMembership & { verifier_name: string }>(
      `SELECT m.*, v.name as verifier_name
       FROM docq_mint_verifier_memberships m
       JOIN docq_mint_verifiers v ON v.id = m.verifier_id
       WHERE m.user_id = $1 AND m.status = 'active'
       ORDER BY m.created_at DESC`,
      [dbUser.id]
    );

    return NextResponse.json({
      user: dbUser,
      memberships,
      verifierMemberships,
    });
  });
}

/**
 * PATCH /api/users/me
 * Update current user profile
 */
export async function PATCH(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { email, first_name, last_name } = body;

    const updatedUser = await queryOne(
      `UPDATE docq_mint_users 
       SET email      = COALESCE($1, email),
           first_name = COALESCE($2, first_name),
           last_name  = COALESCE($3, last_name)
       WHERE id = $4
       RETURNING *`,
      [email || null, first_name || null, last_name || null, dbUser.id]
    );

    return NextResponse.json({ user: updatedUser });
  });
}

