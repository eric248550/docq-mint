import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBDocument } from '@/lib/db/types';

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
    const { document_type, student_id } = body;

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

    // Build update query dynamically
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

    if (updates.length === 0) {
      return NextResponse.json({ document });
    }

    values.push(documentId);

    const updatedDocument = await queryOne<DBDocument>(
      `UPDATE docq_mint_documents
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
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

    await query('DELETE FROM docq_mint_documents WHERE id = $1', [documentId]);

    return NextResponse.json({ success: true });
  });
}

