import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { query, queryOne, getClient } from '@/lib/db/config';
import { DBDocument, DBTag } from '@/lib/db/types';

/**
 * GET /api/documents/:documentId
 * Get document details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { documentId } = params;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const document = await queryOne<DBDocument>(
      'SELECT * FROM docq_mint_documents WHERE id = $1',
      [documentId]
    );

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check access:
    // 1. If student_id matches current user, allow
    // 2. If user has school access (owner/admin/viewer), allow
    if (document.student_id === dbUser.id) {
      return NextResponse.json({ document });
    }

    if (document.school_id) {
      const hasAccess = await checkSchoolAccess(
        dbUser.id,
        document.school_id,
        ['owner', 'admin', 'viewer']
      );

      if (hasAccess) {
        return NextResponse.json({ document });
      }
    }

    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  });
}

/**
 * PATCH /api/documents/:documentId
 * Update document
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { documentId } = params;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const document = await queryOne<DBDocument>(
      'SELECT * FROM docq_mint_documents WHERE id = $1',
      [documentId]
    );

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check access - only school owner/admin can update
    if (document.school_id) {
      const hasAccess = await checkSchoolAccess(
        dbUser.id,
        document.school_id,
        ['owner', 'admin']
      );

      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { document_type, student_id, tag_ids } = body;

    // If student_id is being updated, verify student belongs to school
    if (student_id !== undefined && student_id !== null && document.school_id) {
      const membership = await queryOne(
        `SELECT * FROM docq_mint_school_memberships
         WHERE school_id = $1 AND user_id = $2 AND role = 'student' AND status = 'active'`,
        [document.school_id, student_id]
      );

      if (!membership) {
        return NextResponse.json(
          { error: 'Student not found in this school' },
          { status: 400 }
        );
      }
    }

    // If tag_ids is being set, verify every tag belongs to this document's school
    let validTagIds: string[] | undefined;
    if (tag_ids !== undefined) {
      if (!Array.isArray(tag_ids)) {
        return NextResponse.json({ error: 'tag_ids must be an array' }, { status: 400 });
      }
      validTagIds = Array.from(new Set(tag_ids.filter((t: unknown): t is string => typeof t === 'string')));

      if (validTagIds.length > 0) {
        const owned = await query<{ id: string }>(
          `SELECT id FROM docq_mint_tags WHERE school_id = $1 AND id = ANY($2::uuid[])`,
          [document.school_id, validTagIds]
        );
        if (owned.length !== validTagIds.length) {
          return NextResponse.json(
            { error: 'One or more tags do not belong to this school' },
            { status: 400 }
          );
        }
      }
    }

    // Build column update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (document_type !== undefined) {
      updates.push(`document_type = $${paramCount}`);
      values.push(document_type);
      paramCount++;
    }

    if (student_id !== undefined) {
      updates.push(`student_id = $${paramCount}`);
      values.push(student_id);
      paramCount++;
    }

    if (updates.length > 0) {
      values.push(documentId);
      await query(
        `UPDATE docq_mint_documents
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}`,
        values
      );
    }

    // Sync tags (replace the full set) in a transaction
    if (validTagIds !== undefined) {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM docq_mint_document_tags WHERE document_id = $1', [documentId]);
        if (validTagIds.length > 0) {
          await client.query(
            `INSERT INTO docq_mint_document_tags (document_id, tag_id)
             SELECT $1, unnest($2::uuid[])`,
            [documentId, validTagIds]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // Return the fresh document with its tags aggregated
    const updatedDocument = await queryOne<DBDocument>(
      `SELECT d.*,
              CASE WHEN d.issued_at IS NOT NULL THEN true ELSE false END as is_published,
              COALESCE(
                (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY lower(t.name))
                 FROM docq_mint_document_tags dt
                 JOIN docq_mint_tags t ON t.id = dt.tag_id
                 WHERE dt.document_id = d.id),
                '[]'
              ) as tags
       FROM docq_mint_documents d
       WHERE d.id = $1`,
      [documentId]
    );

    return NextResponse.json({ document: updatedDocument });
  });
}

/**
 * DELETE /api/documents/:documentId
 * Delete document
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { documentId } = params;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const document = await queryOne<DBDocument>(
      'SELECT * FROM docq_mint_documents WHERE id = $1',
      [documentId]
    );

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check access - only school owner/admin can delete
    if (document.school_id) {
      const hasAccess = await checkSchoolAccess(
        dbUser.id,
        document.school_id,
        ['owner', 'admin']
      );

      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Published (minted) documents are immutable on-chain records — block deletion
    if (document.issued_at) {
      return NextResponse.json(
        { error: 'Cannot delete a document that has already been published to the blockchain' },
        { status: 400 }
      );
    }

    await query('DELETE FROM docq_mint_documents WHERE id = $1', [documentId]);

    return NextResponse.json({ success: true });
  });
}

