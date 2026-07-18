import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBDocumentType } from '@/lib/db/types';
import { isAdminEmail } from '@/lib/auth/admin';
import { invalidateDocumentTypesCache } from '@/lib/uploads/documentTypes';

/**
 * POST /api/admin/document-types
 * Admin-only: create a new document type.
 * Body: { label, category?, max_size_mb? }
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { email: callerEmail } = authContext;

    if (!isAdminEmail(callerEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { label, category, max_size_mb } = body as {
      label?: string;
      category?: string | null;
      max_size_mb?: number;
    };

    if (!label?.trim()) {
      return NextResponse.json({ error: 'Label is required' }, { status: 400 });
    }
    const maxSizeMb = max_size_mb === undefined ? 2 : Number(max_size_mb);
    if (!Number.isFinite(maxSizeMb) || maxSizeMb <= 0) {
      return NextResponse.json({ error: 'max_size_mb must be a positive number' }, { status: 400 });
    }

    try {
      const created = await queryOne<DBDocumentType>(
        `INSERT INTO docq_mint_document_types (label, category, max_size_mb)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [label.trim(), category?.trim() || null, maxSizeMb]
      );
      invalidateDocumentTypesCache();
      return NextResponse.json({ documentType: created }, { status: 201 });
    } catch (error) {
      console.error('Failed to create document type:', error);
      return NextResponse.json({ error: 'Failed to create document type' }, { status: 500 });
    }
  });
}

/**
 * GET /api/admin/document-types
 * Admin-only: list all document types with a live count of documents using each one.
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { email: callerEmail } = authContext;

    if (!isAdminEmail(callerEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const documentTypes = await query<DBDocumentType>(
      `SELECT dt.*,
              COALESCE(d.document_count, 0)::int as document_count
       FROM docq_mint_document_types dt
       LEFT JOIN (
         SELECT document_type_id, COUNT(*) as document_count
         FROM docq_mint_documents
         GROUP BY document_type_id
       ) d ON d.document_type_id = dt.id
       ORDER BY dt.label ASC`
    );

    return NextResponse.json({ documentTypes });
  });
}
