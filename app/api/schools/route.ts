import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getUserMemberships } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
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

/**
 * POST /api/schools
 * Create a new school (creates user as owner)
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, country_code, compliance_region } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'School name is required' },
        { status: 400 }
      );
    }

    // Create school
    const school = await queryOne<DBSchool>(
      `INSERT INTO docq_mint_schools (name, country_code, compliance_region)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), country_code || null, compliance_region || null]
    );

    if (!school) {
      return NextResponse.json(
        { error: 'Failed to create school' },
        { status: 500 }
      );
    }

    // Add user as owner
    await query(
      `INSERT INTO docq_mint_school_memberships (school_id, user_id, role, status)
       VALUES ($1, $2, 'owner', 'active')`,
      [school.id, dbUser.id]
    );

    return NextResponse.json({ school }, { status: 201 });
  });
}

