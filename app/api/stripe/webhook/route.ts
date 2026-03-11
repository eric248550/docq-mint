import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/config';
import { stripe } from '@/lib/stripe/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as any;
    const { token_ids, verifier_email, verifier_id, payer_user_id } = pi.metadata || {};

    // Upsert payment record
    const payment = await queryOne<{ id: string }>(
      `INSERT INTO docq_mint_payments
       (stripe_payment_intent_id, amount, currency, status, verifier_id, payer_user_id)
       VALUES ($1, $2, $3, 'succeeded', $4, $5)
       ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET status = 'succeeded'
       RETURNING id`,
      [pi.id, Math.round(pi.amount / 100 * 100) / 100, pi.currency, verifier_id || null, payer_user_id || null]
    );

    if (payment && token_ids) {
      const ids = (token_ids as string).split(',').filter(Boolean);
      for (const tokenId of ids) {
        await query(
          `INSERT INTO docq_mint_verification_access
           (token_id, verifier_email, verifier_id, payment_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [tokenId, verifier_email || null, verifier_id || null, payment.id]
        );
      }
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as any;
    const { verifier_id, payer_user_id } = pi.metadata || {};

    await query(
      `INSERT INTO docq_mint_payments
       (stripe_payment_intent_id, amount, currency, status, verifier_id, payer_user_id)
       VALUES ($1, $2, $3, 'failed', $4, $5)
       ON CONFLICT (stripe_payment_intent_id) DO NOTHING`,
      [pi.id, Math.round(pi.amount / 100 * 100) / 100, pi.currency, verifier_id || null, payer_user_id || null]
    );
  }

  return NextResponse.json({ received: true });
}
