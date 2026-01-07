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

    const updatedDocument = await queryOne<DBDocument>(
      `UPDATE docq_mint_documents
       SET document_type = COALESCE($1, document_type),
           student_id = COALESCE($2, student_id)
       WHERE id = $3
       RETURNING *`,
      [document_type || null, student_id || null, documentId]
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

