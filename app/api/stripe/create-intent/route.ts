import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db/config';
import { DBVerifier } from '@/lib/db/types';
import { stripe } from '@/lib/stripe/client';
import { getOptionalDbUser, resolveMemberVerifierId } from '@/lib/middleware/auth';
import {
  isUuid,
  MAX_DOCUMENTS_PER_PAYMENT,
  PAYMENT_CURRENCY,
  PRICE_PER_DOCUMENT_CENTS,
  tokenIdsToMetadata,
} from '@/lib/stripe/verification-payment';

/**
 * POST /api/stripe/create-intent
 * Create a Stripe PaymentIntent for document verification access.
 * The server decides the price from the number of valid documents.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tokenIds, verifierId: requestedVerifierId, verifierEmail } = body;

  if (!Array.isArray(tokenIds) || tokenIds.length === 0 || !tokenIds.every(isUuid)) {
    return NextResponse.json({ error: 'Valid tokenIds are required' }, { status: 400 });
  }

  const uniqueTokenIds = Array.from(new Set(tokenIds as string[]));

  if (uniqueTokenIds.length > MAX_DOCUMENTS_PER_PAYMENT) {
    return NextResponse.json(
      { error: `You can pay for up to ${MAX_DOCUMENTS_PER_PAYMENT} documents at a time` },
      { status: 400 }
    );
  }

  const validTokens = await query<{ id: string }>(
    `SELECT id FROM docq_mint_verification_tokens
     WHERE id = ANY($1::uuid[]) AND (expires_at IS NULL OR expires_at > now())`,
    [uniqueTokenIds]
  );

  if (validTokens.length !== uniqueTokenIds.length) {
    return NextResponse.json(
      { error: 'One or more documents are invalid or expired' },
      { status: 400 }
    );
  }

  const dbUser = await getOptionalDbUser(request);
  const verifierId = await resolveMemberVerifierId(dbUser, requestedVerifierId);

  const metadata: Record<string, string> = tokenIdsToMetadata(uniqueTokenIds);
  if (verifierEmail) metadata.verifier_email = verifierEmail;
  if (verifierId) metadata.verifier_id = verifierId;
  if (dbUser) metadata.payer_user_id = dbUser.id;

  let stripeCustomerId: string | undefined;

  if (verifierId) {
    const verifier = await queryOne<DBVerifier>(
      'SELECT * FROM docq_mint_verifiers WHERE id = $1',
      [verifierId]
    );

    if (verifier) {
      if (verifier.stripe_customer_id) {
        stripeCustomerId = verifier.stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({ name: verifier.name });
        await query(
          'UPDATE docq_mint_verifiers SET stripe_customer_id = $1 WHERE id = $2',
          [customer.id, verifierId]
        );
        stripeCustomerId = customer.id;
      }
    }
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: uniqueTokenIds.length * PRICE_PER_DOCUMENT_CENTS,
    currency: PAYMENT_CURRENCY,
    metadata,
    automatic_payment_methods: { enabled: true },
    ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
