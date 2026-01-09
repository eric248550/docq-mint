import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBDocument } from '@/lib/db/types';

/**
 * GET /api/schools/:schoolId/documents
 * List documents for a school
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

    // Check access
    const hasAccess = await checkSchoolAccess(
      dbUser.id,
      schoolId,
      ['owner', 'admin', 'viewer']
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    let documents: DBDocument[];
    
    if (studentId) {
      documents = await query<DBDocument>(
        `SELECT * FROM docq_mint_documents 
         WHERE school_id = $1 AND student_id = $2
         ORDER BY created_at DESC`,
        [schoolId, studentId]
      );
    } else {
      documents = await query<DBDocument>(
        `SELECT * FROM docq_mint_documents 
         WHERE school_id = $1
         ORDER BY created_at DESC`,
        [schoolId]
      );
    }

    return NextResponse.json({ documents });
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

