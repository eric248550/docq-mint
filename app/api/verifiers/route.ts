import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBVerifier } from '@/lib/db/types';

/**
 * GET /api/verifiers
 * List verifiers that the user has active membership in
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const verifiers = await query<DBVerifier>(
      `SELECT DISTINCT v.*
       FROM docq_mint_verifiers v
       JOIN docq_mint_verifier_memberships m ON m.verifier_id = v.id
       WHERE m.user_id = $1 AND m.status = 'active'
       ORDER BY v.created_at DESC`,
      [dbUser.id]
    );

    return NextResponse.json({ verifiers });
  });
}

/**
 * POST /api/verifiers
 * Create a new verifier organization
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Verifier name is required' }, { status: 400 });
    }

    const verifier = await queryOne<DBVerifier>(
      `INSERT INTO docq_mint_verifiers (name) VALUES ($1) RETURNING *`,
      [name.trim()]
    );

    if (!verifier) {
      return NextResponse.json({ error: 'Failed to create verifier' }, { status: 500 });
    }

    // Add creator as owner
    await query(
      `INSERT INTO docq_mint_verifier_memberships (verifier_id, user_id, role, status)
       VALUES ($1, $2, 'owner', 'active')`,
      [verifier.id, dbUser.id]
    );

    return NextResponse.json({ verifier }, { status: 201 });
  });
}
