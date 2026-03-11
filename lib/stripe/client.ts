import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY!, {
  apiVersion: '2026-02-25.clover',
});
