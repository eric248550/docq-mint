import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { query, queryOne, getClient } from '@/lib/db/config';
import { DBDocument } from '@/lib/db/types';
import { getFileSizeLimitMB, isValidDocumentType } from '@/lib/uploads/documentTypes';

const DOCUMENT_SELECT = `
  d.*,
  dt.label as document_type_label,
  CASE WHEN d.issued_at IS NOT NULL THEN true ELSE false END as is_published,
  COALESCE(
    (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY lower(t.name))
     FROM docq_mint_document_tags dtags
     JOIN docq_mint_tags t ON t.id = dtags.tag_id
     WHERE dtags.document_id = d.id),
    '[]'
  ) as tags
`;

/**
 * GET /api/schools/:schoolId/documents
 * List documents for a school with pagination, filtering, and sorting
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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    const documentTypeId = searchParams.get('documentTypeId');
    const search = searchParams.get('search');
    const studentEmail = searchParams.get('studentEmail');
    const unassigned = searchParams.get('unassigned');
    const issued = searchParams.get('issued');
    const tags = searchParams.get('tags'); // comma-separated tag ids; OR match
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = ['d.school_id = $1'];
    const qp: any[] = [schoolId];
    let idx = 2;

    if (documentTypeId) {
      conditions.push(`d.document_type_id = $${idx++}`);
      qp.push(documentTypeId);
    }
    if (search) {
      conditions.push(`d.original_filename ILIKE $${idx++}`);
      qp.push(`%${search}%`);
    }
    if (studentEmail) {
      conditions.push(`u.email = $${idx++}`);
      qp.push(studentEmail);
    }
    if (unassigned === 'true') {
      conditions.push('d.student_id IS NULL');
    } else if (unassigned === 'false') {
      conditions.push('d.student_id IS NOT NULL');
    }
    if (issued === 'true') {
      conditions.push('d.issued_at IS NOT NULL');
    } else if (issued === 'false') {
      conditions.push('d.issued_at IS NULL');
    }
    if (tags) {
      const tagIds = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagIds.length > 0) {
        // OR match: document has at least one of the selected tags
        conditions.push(`EXISTS (
          SELECT 1 FROM docq_mint_document_tags dt
          WHERE dt.document_id = d.id AND dt.tag_id = ANY($${idx++}::uuid[])
        )`);
        qp.push(tagIds);
      }
    }

    const where = conditions.join(' AND ');

    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM docq_mint_documents d
       LEFT JOIN docq_mint_users u ON u.id = d.student_id
       WHERE ${where}`,
      qp
    );
    const total = parseInt(countRow?.count || '0', 10);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const data = await query<DBDocument & { is_published: boolean }>(
      `SELECT ${DOCUMENT_SELECT}
       FROM docq_mint_documents d
       LEFT JOIN docq_mint_users u ON u.id = d.student_id
       LEFT JOIN docq_mint_document_types dt ON dt.id = d.document_type_id
       WHERE ${where}
       ORDER BY d.created_at ${sortOrder}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...qp, limit, offset]
    );

    return NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages },
    });
  });
}

/**
 * POST /api/schools/:schoolId/documents
 * Create a document record
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

    // Check access - only owner/admin can create documents
    const hasAccess = await checkSchoolAccess(dbUser.id, schoolId, ['owner', 'admin']);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      student_id,
      document_type_id,
      file_storage_provider,
      file_storage_url,
      file_hash,
      file_mime_type,
      file_size_bytes,
      original_filename,
      tag_ids,
    } = body;

    // Validate required fields
    if (!document_type_id || !file_storage_provider || !file_storage_url || !file_hash) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate document type
    if (!(await isValidDocumentType(document_type_id))) {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      );
    }

    // Defense in depth: the client already enforces per-type size limits before upload.
    if (typeof file_size_bytes === 'number' && file_size_bytes > 0) {
      const limitMB = await getFileSizeLimitMB(document_type_id);
      if (file_size_bytes > limitMB * 1024 * 1024) {
        return NextResponse.json(
          { error: `File exceeds the ${limitMB} MB limit for this document type` },
          { status: 400 }
        );
      }
    }

    // If student_id provided, verify student belongs to school
    if (student_id) {
      const membership = await queryOne(
        `SELECT * FROM docq_mint_school_memberships
         WHERE school_id = $1 AND user_id = $2 AND role = 'student' AND status = 'active'`,
        [schoolId, student_id]
      );

      if (!membership) {
        return NextResponse.json(
          { error: 'Student not found in this school' },
          { status: 400 }
        );
      }
    }

    // If tag_ids provided, verify every tag belongs to this school
    let validTagIds: string[] = [];
    if (tag_ids !== undefined) {
      if (!Array.isArray(tag_ids)) {
        return NextResponse.json({ error: 'tag_ids must be an array' }, { status: 400 });
      }
      validTagIds = Array.from(new Set(tag_ids.filter((t: unknown): t is string => typeof t === 'string')));

      if (validTagIds.length > 0) {
        const owned = await query<{ id: string }>(
          `SELECT id FROM docq_mint_tags WHERE school_id = $1 AND id = ANY($2::uuid[])`,
          [schoolId, validTagIds]
        );
        if (owned.length !== validTagIds.length) {
          return NextResponse.json(
            { error: 'One or more tags do not belong to this school' },
            { status: 400 }
          );
        }
      }
    }

    // Create document (+ tag links) atomically
    const client = await getClient();
    let documentId: string;
    try {
      await client.query('BEGIN');
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO docq_mint_documents
         (school_id, student_id, document_type_id, file_storage_provider,
          file_storage_url, file_hash, file_mime_type, file_size_bytes, original_filename)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          schoolId,
          student_id || null,
          document_type_id,
          file_storage_provider,
          file_storage_url,
          file_hash,
          file_mime_type || null,
          file_size_bytes || null,
          original_filename || null,
        ]
      );
      documentId = inserted.rows[0].id;

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

    // Return the created document with its tags aggregated
    const document = await queryOne<DBDocument>(
      `SELECT ${DOCUMENT_SELECT}
       FROM docq_mint_documents d
       LEFT JOIN docq_mint_document_types dt ON dt.id = d.document_type_id
       WHERE d.id = $1`,
      [documentId]
    );

    return NextResponse.json({ document }, { status: 201 });
  });
}
