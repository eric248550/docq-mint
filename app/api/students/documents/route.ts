import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { query } from '@/lib/db/config';
import { DBDocument } from '@/lib/db/types';

/**
 * GET /api/students/documents
 * List documents for current student user
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get only published/minted documents belonging to this student
    const documents = await query<DBDocument & { is_published: boolean }>(
      `SELECT d.*, 
              CASE WHEN n.id IS NOT NULL THEN true ELSE false END as is_published
       FROM docq_mint_documents d
       INNER JOIN docq_mint_nfts n ON d.id = n.document_id AND n.status = 'minted'
       WHERE d.student_id = $1
       ORDER BY d.created_at DESC`,
      [dbUser.id]
    );

    return NextResponse.json({ documents });
  });
}

