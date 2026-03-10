import { NextRequest, NextResponse } from 'next/server';
import { extractFirebaseToken, verifyFirebaseToken } from '@/lib/auth/firebase-admin';
import { query, queryOne } from '@/lib/db/config';
import { DBUser, DBSchoolMembership } from '@/lib/db/types';
import { createWalletForOwner } from '@/lib/wallet/cardano';

export interface AuthContext {
  firebaseUid: string;
  email?: string;
  dbUser: DBUser | null;
}

/**
 * Middleware to verify Firebase authentication and get/create user
 */
export async function withAuth(
  request: NextRequest,
  handler: (authContext: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Extract and verify Firebase token
    const token = extractFirebaseToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Missing authorization token' },
        { status: 401 }
      );
    }

    const firebaseUser = await verifyFirebaseToken(token);
    if (!firebaseUser) {
      return NextResponse.json(
        { error: 'Invalid authorization token' },
        { status: 401 }
      );
    }

    // Get or create user in database
    let dbUser = await queryOne<DBUser>(
      'SELECT * FROM docq_mint_users WHERE firebase_uid = $1',
      [firebaseUser.uid]
    );

    if (!dbUser) {
      // Auto-create user on first login
      const rows = await query<DBUser>(
        `INSERT INTO docq_mint_users (firebase_uid, email)
         VALUES ($1, $2)
         RETURNING *`,
        [firebaseUser.uid, firebaseUser.email || null]
      );
      dbUser = rows[0];

      // Create wallet for user (holder role)
      const network = process.env.CARDANO_NETWORK === 'mainnet' ? 'mainnet' : 'preprod';
      const wallet = await createWalletForOwner(dbUser.id, 'holder', network as 'mainnet' | 'preprod');

      if (!wallet) {
        console.error('Failed to create wallet for user, but continuing with user creation');
      }
    }

    // Execute handler with auth context
    return await handler({
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email,
      dbUser,
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

/**
 * Check if user has school membership with required role
 */
export async function checkSchoolAccess(
  userId: string,
  schoolId: string,
  requiredRoles: string[]
): Promise<boolean> {
  const membership = await queryOne<DBSchoolMembership>(
    `SELECT * FROM docq_mint_school_memberships 
     WHERE user_id = $1 AND school_id = $2 AND status = 'active'`,
    [userId, schoolId]
  );

  if (!membership) return false;
  return requiredRoles.includes(membership.role);
}

/**
 * Get user's school memberships
 */
export async function getUserMemberships(userId: string): Promise<DBSchoolMembership[]> {
  return await query<DBSchoolMembership>(
    `SELECT * FROM docq_mint_school_memberships 
     WHERE user_id = $1 AND status = 'active'
     ORDER BY created_at DESC`,
    [userId]
  );
}

