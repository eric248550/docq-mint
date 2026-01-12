import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/config';
import { DBVerificationToken, DBDocument, DBVerificationAccess } from '@/lib/db/types';

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

  // Get the document
  const document = await queryOne<DBDocument>(
    'SELECT * FROM docq_mint_documents WHERE id = $1',
    [verificationToken.document_id]
  );

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Return document metadata (without the actual file URL for now)
  return NextResponse.json({
    tokenId: verificationToken.id,
    document: {
      id: document.id,
      documentType: document.document_type,
      originalFilename: document.original_filename,
      fileHash: document.file_hash,
      fileMimeType: document.file_mime_type,
      fileSizeBytes: document.file_size_bytes,
      issuedAt: document.issued_at,
      createdAt: document.created_at,
    },
  });
}

/**
 * POST /api/verify/:token/payment
 * Mock payment to access document
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;
  const body = await request.json();
  const { verifierEmail } = body;

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

  // Record the payment/access
  const access = await queryOne<DBVerificationAccess>(
    `INSERT INTO docq_mint_verification_access 
     (token_id, verifier_email, payment_status, payment_amount) 
     VALUES ($1, $2, $3, $4) 
     RETURNING *`,
    [verificationToken.id, verifierEmail, 'paid', 2.00]
  );

  if (!access) {
    return NextResponse.json(
      { error: 'Failed to record payment' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    accessId: access.id,
    message: 'Payment successful',
  });
}

