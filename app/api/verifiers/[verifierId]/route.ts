import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkVerifierAccess } from '@/lib/middleware/auth';
import { queryOne } from '@/lib/db/config';
import { DBVerifier } from '@/lib/db/types';

/**
 * GET /api/verifiers/:verifierId
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { verifierId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { verifierId } = params;
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const hasAccess = await checkVerifierAccess(dbUser.id, verifierId, ['owner', 'admin', 'viewer']);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const verifier = await queryOne<DBVerifier>(
      'SELECT * FROM docq_mint_verifiers WHERE id = $1',
      [verifierId]
    );
    if (!verifier) return NextResponse.json({ error: 'Verifier not found' }, { status: 404 });

    return NextResponse.json({ verifier });
  });
}

/**
 * PATCH /api/verifiers/:verifierId
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { verifierId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { verifierId } = params;
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const hasAccess = await checkVerifierAccess(dbUser.id, verifierId, ['owner', 'admin']);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const body = await request.json();
    const { name } = body;

    const verifier = await queryOne<DBVerifier>(
      'UPDATE docq_mint_verifiers SET name = COALESCE($1, name) WHERE id = $2 RETURNING *',
      [name || null, verifierId]
    );

    return NextResponse.json({ verifier });
  });
}

/**
 * DELETE /api/verifiers/:verifierId
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { verifierId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { verifierId } = params;
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const hasAccess = await checkVerifierAccess(dbUser.id, verifierId, ['owner']);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    await queryOne(
      'DELETE FROM docq_mint_verifiers WHERE id = $1',
      [verifierId]
    );

    return NextResponse.json({ success: true });
  });
}
