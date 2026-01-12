import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/config';
import { DBVerificationToken, DBDocument, DBVerificationAccess } from '@/lib/db/types';
import { createHash } from 'crypto';

/**
 * POST /api/verify/:token/compare
 * Compare uploaded file hash with original document hash
 */
export async function POST(
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
    `SELECT * FROM docq_mint_verification_access 
     WHERE token_id = $1 AND payment_status = 'paid' 
     ORDER BY accessed_at DESC LIMIT 1`,
    [verificationToken.id]
  );

  if (!paidAccess) {
    return NextResponse.json(
      { error: 'Payment required to compare documents' },
      { status: 402 }
    );
  }

  // Get the original document
  const document = await queryOne<DBDocument>(
    'SELECT * FROM docq_mint_documents WHERE id = $1',
    [verificationToken.document_id]
  );

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Get the uploaded file from form data
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  // Calculate hash of uploaded file
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const uploadedHash = createHash('sha256').update(buffer).digest('hex');

  // Compare hashes
  const matches = uploadedHash === document.file_hash;

  return NextResponse.json({
    matches,
    originalHash: document.file_hash,
    uploadedHash,
    fileName: file.name,
    fileSize: file.size,
  });
}

