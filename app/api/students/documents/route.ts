import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBDocument } from '@/lib/db/types';

/**
 * GET /api/students/documents
 * List documents for current student user with pagination, filtering, and sorting
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    const documentType = searchParams.get('documentType');
    const search = searchParams.get('search');
    const issued = searchParams.get('issued');
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = ['d.student_id = $1'];
    const qp: any[] = [dbUser.id];
    let idx = 2;

    // Default: only show issued docs; explicit issued=false returns unissued
    if (issued === 'false') {
      conditions.push('d.issued_at IS NULL');
    } else {
      conditions.push('d.issued_at IS NOT NULL');
    }

    if (documentType) {
      conditions.push(`d.document_type = $${idx++}`);
      qp.push(documentType);
    }
    if (search) {
      conditions.push(`d.original_filename ILIKE $${idx++}`);
      qp.push(`%${search}%`);
    }

    const where = conditions.join(' AND ');

    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM docq_mint_documents d WHERE ${where}`,
      qp
    );
    const total = parseInt(countRow?.count || '0', 10);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const data = await query<DBDocument & { is_published: boolean }>(
      `SELECT d.*,
              CASE WHEN d.issued_at IS NOT NULL THEN true ELSE false END as is_published
       FROM docq_mint_documents d
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
