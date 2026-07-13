import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBTag } from '@/lib/db/types';

/**
 * PATCH /api/schools/:schoolId/tags/:tagId
 * Rename / recolor a tag (owner/admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { schoolId: string; tagId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { schoolId, tagId } = params;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const hasAccess = await checkSchoolAccess(dbUser.id, schoolId, ['owner', 'admin']);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const tag = await queryOne<DBTag>(
      `SELECT * FROM docq_mint_tags WHERE id = $1 AND school_id = $2`,
      [tagId, schoolId]
    );

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const body = await request.json();

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        return NextResponse.json({ error: 'Tag name cannot be empty' }, { status: 400 });
      }

      // Reject a rename that would collide with another tag in the school
      const clash = await queryOne<DBTag>(
        `SELECT id FROM docq_mint_tags
         WHERE school_id = $1 AND lower(name) = lower($2) AND id <> $3`,
        [schoolId, name, tagId]
      );
      if (clash) {
        return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 });
      }

      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (body.color !== undefined) {
      const color = typeof body.color === 'string' && body.color.trim() !== '' ? body.color.trim() : null;
      updates.push(`color = $${paramCount++}`);
      values.push(color);
    }

    if (updates.length === 0) {
      return NextResponse.json({ tag });
    }

    values.push(tagId);

    const updated = await queryOne<DBTag>(
      `UPDATE docq_mint_tags SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return NextResponse.json({ tag: updated });
  });
}

/**
 * DELETE /api/schools/:schoolId/tags/:tagId
 * Delete a tag (owner/admin only). Document links are removed via ON DELETE CASCADE.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string; tagId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { schoolId, tagId } = params;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const hasAccess = await checkSchoolAccess(dbUser.id, schoolId, ['owner', 'admin']);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const tag = await queryOne<DBTag>(
      `SELECT id FROM docq_mint_tags WHERE id = $1 AND school_id = $2`,
      [tagId, schoolId]
    );

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    await query('DELETE FROM docq_mint_tags WHERE id = $1', [tagId]);

    return NextResponse.json({ success: true });
  });
}
