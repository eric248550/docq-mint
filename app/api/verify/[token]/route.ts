import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/config';
import { DBVerificationToken, DBDocument } from '@/lib/db/types';
import { hasVerificationAccess } from '@/lib/verify/access';

/**
 * GET /api/verify/:token
 * Get document information for a verification token (after payment)
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

  // Get the document (joined to the catalog for a human-readable type label)
  const document = await queryOne<DBDocument>(
    `SELECT d.*, dt.label as document_type_label
     FROM docq_mint_documents d
     LEFT JOIN docq_mint_document_types dt ON dt.id = d.document_type_id
     WHERE d.id = $1`,
    [verificationToken.document_id]
  );

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const hasAccess = await hasVerificationAccess(request, verificationToken.id);

  // Return document metadata (without the actual file URL for now)
  return NextResponse.json({
    tokenId: verificationToken.id,
    hasAccess,
    document: {
      id: document.id,
      documentType: document.document_type_label || 'Document',
      originalFilename: document.original_filename,
      fileHash: document.file_hash,
      fileMimeType: document.file_mime_type,
      fileSizeBytes: document.file_size_bytes,
      issuedAt: document.issued_at,
      createdAt: document.created_at,
    },
  });
}

