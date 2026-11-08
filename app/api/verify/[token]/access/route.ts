import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/config';
import { DBVerificationToken } from '@/lib/db/types';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import { getOptionalDbUser, resolveMemberVerifierId } from '@/lib/middleware/auth';
import { paymentCoversToken } from '@/lib/stripe/verification-payment';

/**
 * POST /api/verify/:token/access
 * Confirm payment and create access record after successful Stripe payment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;
  const dbUser = await getOptionalDbUser(request);
  const body = await request.json();
  const { paymentIntentId, verifierEmail, verifierId: requestedVerifierId } = body;
  const verifierId = await resolveMemberVerifierId(dbUser, requestedVerifierId);

  if (!paymentIntentId) {
    return NextResponse.json({ error: 'paymentIntentId is required' }, { status: 400 });
  }

  // Verify the PaymentIntent with Stripe
  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    return NextResponse.json({ error: 'Invalid payment' }, { status: 400 });
  }

  if (pi.status !== 'succeeded') {
    return NextResponse.json(
      { error: 'Payment has not succeeded' },
      { status: 402 }
    );
  }

  // Get verification token
  const verificationToken = await queryOne<DBVerificationToken>(
    'SELECT * FROM docq_mint_verification_tokens WHERE token = $1',
    [token]
  );

  if (!verificationToken) {
    return NextResponse.json({ error: 'Invalid verification token' }, { status: 404 });
  }

  if (verificationToken.expires_at && new Date(verificationToken.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Verification token has expired' }, { status: 410 });
  }

  if (!paymentCoversToken(pi, verificationToken.id)) {
    return NextResponse.json({ error: 'Payment does not cover this document' }, { status: 402 });
  }

  // Upsert payment record
  const payment = await queryOne<{ id: string }>(
    `INSERT INTO docq_mint_payments
     (stripe_payment_intent_id, amount, currency, status, verifier_id, payer_user_id)
     VALUES ($1, $2, $3, 'succeeded', $4, $5)
     ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET status = 'succeeded'
     RETURNING id`,
    [pi.id, Math.round(pi.amount / 100 * 100) / 100, pi.currency, verifierId || null, dbUser?.id || null]
  );

  if (!payment) {
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }

  // Upsert access record
  const access = await queryOne<{ id: string }>(
    `INSERT INTO docq_mint_verification_access
     (token_id, verifier_email, verifier_id, payment_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [verificationToken.id, verifierEmail || null, verifierId || null, payment.id]
  );

  // If ON CONFLICT DO NOTHING returned nothing, fetch existing
  const accessId = access?.id || (await queryOne<{ id: string }>(
    'SELECT id FROM docq_mint_verification_access WHERE token_id = $1 AND payment_id = $2',
    [verificationToken.id, payment.id]
  ))?.id;

  return NextResponse.json({ success: true, accessId });
}
