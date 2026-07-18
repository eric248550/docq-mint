import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBDocumentType } from '@/lib/db/types';
import { isAdminEmail } from '@/lib/auth/admin';
import { countDocumentsOfType, invalidateDocumentTypesCache } from '@/lib/uploads/documentTypes';

/**
 * PATCH /api/admin/document-types/:id
 * Admin-only: update label / category / max_size_mb / is_active.
 * `id` is immutable — it's the value stored on existing documents.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (authContext) => {
    const { email: callerEmail } = authContext;

    if (!isAdminEmail(callerEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await queryOne<DBDocumentType>(
      `SELECT * FROM docq_mint_document_types WHERE id = $1`,
      [params.id]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Document type not found' }, { status: 404 });
    }

    const body = await request.json();
    const { label, category, max_size_mb, is_active } = body as {
      label?: string;
      category?: string | null;
      max_size_mb?: number;
      is_active?: boolean;
    };

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (label !== undefined) {
      if (!label.trim()) {
        return NextResponse.json({ error: 'Label cannot be empty' }, { status: 400 });
      }
      updates.push(`label = $${idx++}`);
      values.push(label.trim());
    }
    if (category !== undefined) {
      updates.push(`category = $${idx++}`);
      values.push(category?.trim() || null);
    }
    if (max_size_mb !== undefined) {
      const maxSizeMb = Number(max_size_mb);
      if (!Number.isFinite(maxSizeMb) || maxSizeMb <= 0) {
        return NextResponse.json({ error: 'max_size_mb must be a positive number' }, { status: 400 });
      }
      updates.push(`max_size_mb = $${idx++}`);
      values.push(maxSizeMb);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(!!is_active);
    }

    if (updates.length === 0) {
      return NextResponse.json({ documentType: existing });
    }

    updates.push(`updated_at = now()`);
    values.push(params.id);

    const updated = await queryOne<DBDocumentType>(
      `UPDATE docq_mint_document_types
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING *`,
      values
    );

    invalidateDocumentTypesCache();
    return NextResponse.json({ documentType: updated });
  });
}

/**
 * DELETE /api/admin/document-types/:id
 * Admin-only: hard-delete a document type, but only if no documents use it.
 * If it's in use, the FK constraint would block the delete anyway — return
 * a friendly 409 instead so the admin UI can offer to deactivate it.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (authContext) => {
    const { email: callerEmail } = authContext;

    if (!isAdminEmail(callerEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await queryOne<DBDocumentType>(
      `SELECT * FROM docq_mint_document_types WHERE id = $1`,
      [params.id]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Document type not found' }, { status: 404 });
    }

    const documentCount = await countDocumentsOfType(existing.id);
    if (documentCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete "${existing.label}" — ${documentCount} document(s) use this type. Deactivate it instead.`,
          documentCount,
        },
        { status: 409 }
      );
    }

    await query(`DELETE FROM docq_mint_document_types WHERE id = $1`, [params.id]);
    invalidateDocumentTypesCache();
    return NextResponse.json({ success: true });
  });
}
