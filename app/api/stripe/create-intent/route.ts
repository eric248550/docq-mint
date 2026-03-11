import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db/config';
import { DBVerifier } from '@/lib/db/types';
import { stripe } from '@/lib/stripe/client';
import { getOptionalDbUser } from '@/lib/middleware/auth';

/**
 * POST /api/stripe/create-intent
 * Create a Stripe PaymentIntent for document verification access
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { amount, currency = 'usd', tokenIds, verifierId, verifierEmail } = body;

  if (!amount || !tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
    return NextResponse.json({ error: 'amount and tokenIds are required' }, { status: 400 });
  }

  const dbUser = await getOptionalDbUser(request);

  const metadata: Record<string, string> = {
    token_ids: tokenIds.join(','),
  };
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
    amount,
    currency,
    metadata,
    automatic_payment_methods: { enabled: true },
    ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
