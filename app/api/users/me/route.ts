import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBSchoolMembership, DBSchool } from '@/lib/db/types';

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

    return NextResponse.json({
      user: dbUser,
      memberships,
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
    const { email } = body;

    // Update user
    const updatedUser = await queryOne(
      `UPDATE docq_mint_users 
       SET email = COALESCE($1, email)
       WHERE id = $2
       RETURNING *`,
      [email || null, dbUser.id]
    );

    return NextResponse.json({ user: updatedUser });
  });
}

