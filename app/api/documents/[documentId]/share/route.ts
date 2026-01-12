import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { queryOne } from '@/lib/db/config';
import { DBDocument, DBVerificationToken } from '@/lib/db/types';
import { randomBytes } from 'crypto';

/**
 * POST /api/documents/:documentId/share
 * Generate a shareable verification link for a document
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { documentId } = params;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get document and verify it belongs to the user
    const document = await queryOne<DBDocument>(
      'SELECT * FROM docq_mint_documents WHERE id = $1',
      [documentId]
    );

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Only the student who owns the document can share it
    if (document.student_id !== dbUser.id) {
      return NextResponse.json(
        { error: 'You can only share your own documents' },
        { status: 403 }
      );
    }

    // Generate a unique token (URL-safe)
    const token = randomBytes(32).toString('base64url');

    // Set expiration to 30 days from now (or null for no expiration)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Store the verification token
    const verificationToken = await queryOne<DBVerificationToken>(
      `INSERT INTO docq_mint_verification_tokens 
       (document_id, token, created_by, expires_at) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [documentId, token, dbUser.id, expiresAt]
    );

    if (!verificationToken) {
      return NextResponse.json(
        { error: 'Failed to generate verification link' },
        { status: 500 }
      );
    }

    // Generate the verification URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/verify?token=${token}`;

    return NextResponse.json({
      token: verificationToken.token,
      url: verificationUrl,
      expiresAt: verificationToken.expires_at,
    });
  });
}

