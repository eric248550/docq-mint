import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBTag } from '@/lib/db/types';

/**
 * GET /api/schools/:schoolId/tags
 * List all tags for a school (used by the filter dropdown and tag picker)
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

    const data = await query<DBTag>(
      `SELECT * FROM docq_mint_tags WHERE school_id = $1 ORDER BY lower(name) ASC`,
      [schoolId]
    );

    return NextResponse.json({ data });
  });
}

/**
 * POST /api/schools/:schoolId/tags
 * Create a tag (owner/admin only)
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

    const hasAccess = await checkSchoolAccess(dbUser.id, schoolId, ['owner', 'admin']);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const color = typeof body.color === 'string' && body.color.trim() !== '' ? body.color.trim() : null;

    if (!name) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    // Enforce case-insensitive uniqueness within the school (matches the DB index)
    const existing = await queryOne<DBTag>(
      `SELECT * FROM docq_mint_tags WHERE school_id = $1 AND lower(name) = lower($2)`,
      [schoolId, name]
    );

    if (existing) {
      return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 });
    }

    const tag = await queryOne<DBTag>(
      `INSERT INTO docq_mint_tags (school_id, name, color, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [schoolId, name, color, dbUser.id]
    );

    return NextResponse.json({ tag }, { status: 201 });
  });
}
