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

    // Get all documents belonging to this student
    const documents = await query<DBDocument>(
      `SELECT * FROM docq_mint_documents 
       WHERE student_id = $1
       ORDER BY created_at DESC`,
      [dbUser.id]
    );

    return NextResponse.json({ documents });
  });
}

