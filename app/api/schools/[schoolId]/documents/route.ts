import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBDocument } from '@/lib/db/types';

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

    const documentType = searchParams.get('documentType');
    const search = searchParams.get('search');
    const studentEmail = searchParams.get('studentEmail');
    const unassigned = searchParams.get('unassigned');
    const issued = searchParams.get('issued');
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = ['d.school_id = $1'];
    const qp: any[] = [schoolId];
    let idx = 2;

    if (documentType) {
      conditions.push(`d.document_type = $${idx++}`);
      qp.push(documentType);
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
      `SELECT d.*,
              CASE WHEN d.issued_at IS NOT NULL THEN true ELSE false END as is_published
       FROM docq_mint_documents d
       LEFT JOIN docq_mint_users u ON u.id = d.student_id
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
      document_type,
      file_storage_provider,
      file_storage_url,
      file_hash,
      file_mime_type,
      file_size_bytes,
      original_filename,
    } = body;

    // Validate required fields
    if (!document_type || !file_storage_provider || !file_storage_url || !file_hash) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate document type
    const validTypes = ['report_card', 'transcript', 'certificate', 'diploma', 'others'];
    if (!validTypes.includes(document_type)) {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      );
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

    // Create document
    const document = await queryOne<DBDocument>(
      `INSERT INTO docq_mint_documents 
       (school_id, student_id, document_type, file_storage_provider, 
        file_storage_url, file_hash, file_mime_type, file_size_bytes, original_filename)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        schoolId,
        student_id || null,
        document_type,
        file_storage_provider,
        file_storage_url,
        file_hash,
        file_mime_type || null,
        file_size_bytes || null,
        original_filename || null,
      ]
    );

    return NextResponse.json({ document }, { status: 201 });
  });
}

