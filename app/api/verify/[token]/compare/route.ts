import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/config';
import { DBVerificationToken, DBDocument } from '@/lib/db/types';
import { MAX_FILE_UPLOAD_BYTES, MAX_FILE_UPLOAD_MB } from '@/lib/uploads/limits';
import { hasVerificationAccess } from '@/lib/verify/access';
import { createHash } from 'crypto';

// Room for the multipart boundary and field headers around the file.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const FILE_TOO_LARGE = `File is too large. Max size is ${MAX_FILE_UPLOAD_MB}MB.`;

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

  if (!(await hasVerificationAccess(request, verificationToken.id))) {
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

  // Reject oversized bodies before parsing them into memory
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_FILE_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return NextResponse.json({ error: FILE_TOO_LARGE }, { status: 413 });
  }

  // Get the uploaded file from form data
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  if (file.size > MAX_FILE_UPLOAD_BYTES) {
    return NextResponse.json({ error: FILE_TOO_LARGE }, { status: 413 });
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

