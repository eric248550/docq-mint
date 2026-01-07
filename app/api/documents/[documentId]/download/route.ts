import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { queryOne } from '@/lib/db/config';
import { DBDocument } from '@/lib/db/types';
import { getDownloadPresignedUrl } from '@/lib/s3/presigned';

/**
 * GET /api/documents/:documentId/download
 * Get presigned URL for downloading a document
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

    // Get document
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
    let hasAccess = false;

    if (document.student_id === dbUser.id) {
      hasAccess = true;
    } else if (document.school_id) {
      hasAccess = await checkSchoolAccess(
        dbUser.id,
        document.school_id,
        ['owner', 'admin', 'viewer']
      );
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Extract S3 key from URL
    // URL format: https://bucket.s3.amazonaws.com/key or https://bucket.s3.region.amazonaws.com/key
    let s3Key: string;
    try {
      const url = new URL(document.file_storage_url);
      // Remove leading slash from pathname
      s3Key = url.pathname.substring(1);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid document URL' },
        { status: 400 }
      );
    }

    // Generate presigned URL for download
    try {
      const presignedUrl = await getDownloadPresignedUrl(s3Key);

      return NextResponse.json({
        url: presignedUrl,
        fileName: s3Key.split('/').pop() || 'document',
        expiresIn: 3600, // 1 hour
      });
    } catch (error) {
      console.error('Failed to generate presigned URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      );
    }
  });
}

