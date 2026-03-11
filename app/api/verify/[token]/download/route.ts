import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/config';
import { DBVerificationToken, DBDocument, DBVerificationAccess } from '@/lib/db/types';
import { getDownloadPresignedUrl } from '@/lib/s3/presigned';

/**
 * GET /api/verify/:token/download
 * Get presigned URL for downloading a verified document (requires payment)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;

  // Get verification token
  const verificationToken = await queryOne<DBVerificationToken>(
    'SELECT * FROM docq_mint_verification_tokens WHERE token = $1',
    [token]
  );

  if (!verificationToken) {
    return NextResponse.json(
      { error: 'Invalid verification token' },
      { status: 404 }
    );
  }

  // Check if token is expired
  if (verificationToken.expires_at && new Date(verificationToken.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'Verification token has expired' },
      { status: 410 }
    );
  }

  // Check if there's a paid access record for this token
  const paidAccess = await queryOne<DBVerificationAccess>(
    `SELECT va.* FROM docq_mint_verification_access va
     JOIN docq_mint_payments p ON p.id = va.payment_id
     WHERE va.token_id = $1 AND p.status = 'succeeded'
     ORDER BY va.created_at DESC LIMIT 1`,
    [verificationToken.id]
  );

  if (!paidAccess) {
    return NextResponse.json(
      { error: 'Payment required to access document' },
      { status: 402 }
    );
  }

  // Get the document
  const document = await queryOne<DBDocument>(
    'SELECT * FROM docq_mint_documents WHERE id = $1',
    [verificationToken.document_id]
  );

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Extract S3 key from URL
  let s3Key: string;
  try {
    const url = new URL(document.file_storage_url);
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
      fileName: document.original_filename || s3Key.split('/').pop() || 'document',
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('Failed to generate presigned URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}

