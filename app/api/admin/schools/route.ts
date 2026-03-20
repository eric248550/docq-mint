import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { DBSchool, DBUser } from '@/lib/db/types';
import { createWalletForOwner } from '@/lib/wallet/cardano';
import { sendSchoolCreatedEmail } from '@/lib/ses/send-school-created';

const ADMIN_EMAIL_DOMAIN = 'docq-mint.com';

/**
 * POST /api/admin/schools
 * Admin-only: Create a school org and assign an owner by email
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { email: callerEmail } = authContext;

    // Restrict to docq-mint.com emails
    if (!callerEmail || !callerEmail.endsWith(`@${ADMIN_EMAIL_DOMAIN}`)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, country_code, compliance_region, owner_email } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'School name is required' }, { status: 400 });
    }
    if (!owner_email?.trim()) {
      return NextResponse.json({ error: 'Owner email is required' }, { status: 400 });
    }

    const normalizedOwnerEmail = owner_email.trim().toLowerCase();

    // Create school
    const school = await queryOne<DBSchool>(
      `INSERT INTO docq_mint_schools (name, country_code, compliance_region)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), country_code || null, compliance_region || null]
    );

    if (!school) {
      return NextResponse.json({ error: 'Failed to create school' }, { status: 500 });
    }

    // Create issuer wallet for school
    const network = process.env.CARDANO_NETWORK === 'mainnet' ? 'mainnet' : 'preprod';
    const wallet = await createWalletForOwner(school.id, 'issuer', network as 'mainnet' | 'preprod');

    if (!wallet) {
      console.error('Failed to create wallet for school, but continuing');
    } else {
      await query(
        `UPDATE docq_mint_schools SET custody_wallet_id = $1 WHERE id = $2`,
        [wallet.id, school.id]
      );
    }

    // Check if user exists by email
    const existingUser = await queryOne<DBUser>(
      `SELECT * FROM docq_mint_users WHERE LOWER(email) = $1`,
      [normalizedOwnerEmail]
    );

    if (existingUser) {
      // Assign as active owner immediately
      await query(
        `INSERT INTO docq_mint_school_memberships (school_id, user_id, invite_email, role, status)
         VALUES ($1, $2, $3, 'owner', 'active')`,
        [school.id, existingUser.id, normalizedOwnerEmail]
      );
    } else {
      // Create pending membership — activated when user logs in
      await query(
        `INSERT INTO docq_mint_school_memberships (school_id, user_id, invite_email, role, status)
         VALUES ($1, NULL, $2, 'owner', 'invited')`,
        [school.id, normalizedOwnerEmail]
      );
    }

    // Send notification email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    try {
      await sendSchoolCreatedEmail({
        to: normalizedOwnerEmail,
        schoolName: school.name,
        isNewUser: !existingUser,
        appUrl,
      });
    } catch (emailErr) {
      console.error('Failed to send school created email:', emailErr);
    }

    return NextResponse.json(
      {
        school: { ...school, custody_wallet_id: wallet?.id },
        owner_email: normalizedOwnerEmail,
        owner_status: existingUser ? 'active' : 'invited',
      },
      { status: 201 }
    );
  });
}
