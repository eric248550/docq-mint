import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { query } from '@/lib/db/config';
import { DBSchool } from '@/lib/db/types';

/**
 * GET /api/schools
 * List schools that the user has access to
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get schools user has membership in
    const schools = await query<DBSchool>(
      `SELECT DISTINCT s.*
       FROM docq_mint_schools s
       JOIN docq_mint_school_memberships m ON m.school_id = s.id
       WHERE m.user_id = $1 AND m.status = 'active'
       ORDER BY s.created_at DESC`,
      [dbUser.id]
    );

    return NextResponse.json({ schools });
  });
}
