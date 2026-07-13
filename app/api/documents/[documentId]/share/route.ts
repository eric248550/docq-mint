import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBDocument, DBVerificationToken } from '@/lib/db/types';
import { randomBytes } from 'crypto';

function buildVerificationUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/verify?token=${token}`;
}

/**
 * GET /api/documents/:documentId/share
 * List existing verification links for a document (owner only)
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

    const document = await queryOne<DBDocument>(
      'SELECT * FROM docq_mint_documents WHERE id = $1',
      [documentId]
    );

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.student_id !== dbUser.id) {
      return NextResponse.json(
        { error: 'You can only view links for your own documents' },
        { status: 403 }
      );
    }

    const tokens = await query<DBVerificationToken>(
      `SELECT * FROM docq_mint_verification_tokens
       WHERE document_id = $1
       ORDER BY created_at DESC`,
      [documentId]
    );

    const now = Date.now();
    const links = tokens.map((t) => ({
      id: t.id,
      token: t.token,
      url: buildVerificationUrl(t.token),
      expiresAt: t.expires_at,
      createdAt: t.created_at,
      isExpired: t.expires_at ? new Date(t.expires_at).getTime() <= now : false,
    }));

    return NextResponse.json({ links });
  });
}

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

    // Determine expiration from the request body.
    // - `expiresAt` provided as an ISO string  -> custom expiry (must be a valid future date)
    // - `expiresAt` explicitly null            -> never expires
    // - body missing / no `expiresAt` key       -> default to 30 days from now
    let expiresAt: Date | null;
    let body: { expiresAt?: string | null } = {};
    try {
      body = await request.json();
    } catch {
      // No/invalid JSON body — fall back to default below
    }

    if (body && 'expiresAt' in body) {
      if (body.expiresAt === null) {
        expiresAt = null;
      } else {
        const parsed = new Date(body.expiresAt as string);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: 'Invalid expiration date' },
            { status: 400 }
          );
        }
        if (parsed.getTime() <= Date.now()) {
          return NextResponse.json(
            { error: 'Expiration date must be in the future' },
            { status: 400 }
          );
        }
        expiresAt = parsed;
      }
    } else {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
    }

    // Generate a unique token (URL-safe)
    const token = randomBytes(32).toString('base64url');

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

    return NextResponse.json({
      token: verificationToken.token,
      url: buildVerificationUrl(verificationToken.token),
      expiresAt: verificationToken.expires_at,
    });
  });
}

