import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBSchool } from '@/lib/db/types';
import { isValidSchoolType } from '@/lib/schools/schoolTypes';

/**
 * GET /api/schools/:schoolId
 * Get organization details
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
      ['owner', 'admin', 'viewer', 'student', 'parent']
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const school = await queryOne<DBSchool>(
      'SELECT * FROM docq_mint_schools WHERE id = $1',
      [schoolId]
    );

    if (!school) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ school });
  });
}

/**
 * PATCH /api/schools/:schoolId
 * Update organization details
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { schoolId } = params;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check access - only owner/admin can update
    const hasAccess = await checkSchoolAccess(dbUser.id, schoolId, ['owner', 'admin']);

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, country_code, compliance_region, logo_url, school_type } = body;

    // Only owners can update the org logo
    if (logo_url !== undefined) {
      const isOwner = await checkSchoolAccess(dbUser.id, schoolId, ['owner']);
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Only the org owner can update the logo' },
          { status: 403 }
        );
      }
    }

    let nextSchoolType: string | null | undefined = undefined;
    if (school_type !== undefined) {
      const value =
        typeof school_type === 'string' && school_type.trim() ? school_type.trim() : null;
      if (value && !isValidSchoolType(value)) {
        return NextResponse.json({ error: 'Invalid organization type' }, { status: 400 });
      }
      nextSchoolType = value;
    }

    const school = await queryOne<DBSchool>(
      `UPDATE docq_mint_schools 
       SET name = COALESCE($1, name),
           country_code = COALESCE($2, country_code),
           compliance_region = COALESCE($3, compliance_region),
           logo_url = CASE WHEN $4::text IS NOT NULL THEN $4::text ELSE logo_url END,
           school_type = CASE WHEN $5::boolean THEN $6 ELSE school_type END
       WHERE id = $7
       RETURNING *`,
      [
        name || null,
        country_code || null,
        compliance_region || null,
        logo_url || null,
        nextSchoolType !== undefined,
        nextSchoolType ?? null,
        schoolId
      ]
    );

    if (!school) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ school });
  });
}

/**
 * DELETE /api/schools/:schoolId
 * Delete school (soft delete by removing all memberships)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { schoolId } = params;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check access - only owner can delete
    const hasAccess = await checkSchoolAccess(dbUser.id, schoolId, ['owner']);

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Only the organization owner can delete' },
        { status: 403 }
      );
    }

    // For MVP, we'll actually delete the school
    // In production, consider soft delete or archiving
    await query('DELETE FROM docq_mint_schools WHERE id = $1', [schoolId]);

    return NextResponse.json({ success: true });
  });
}

