import {
  isPaymentAmountValid,
  paymentCoversToken,
  tokenIdsFromMetadata,
  tokenIdsToMetadata,
} from '@/lib/stripe/verification-payment';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = (count: number) => Array.from({ length: count }, (_, i) => uuid(i));

describe('token metadata', () => {
  it('round-trips 100 tokens within Stripe value limits', () => {
    const metadata = tokenIdsToMetadata(ids(100));
    expect(Object.values(metadata).every((value) => value.length <= 500)).toBe(true);
    expect(tokenIdsFromMetadata(metadata)).toEqual(ids(100));
  });

  it('reads the legacy single field and ignores other metadata', () => {
    expect(tokenIdsFromMetadata({ token_ids: `${uuid(1)},${uuid(2)}`, verifier_id: uuid(9) })).toEqual([uuid(1), uuid(2)]);
  });
});

describe('payment validation', () => {
  const metadata = tokenIdsToMetadata(ids(2));

  it('accepts a full payment for a listed token', () => {
    expect(paymentCoversToken({ amount: 400, currency: 'usd', metadata }, uuid(1))).toBe(true);
  });

  it('rejects a token the payment does not list', () => {
    expect(paymentCoversToken({ amount: 400, currency: 'usd', metadata }, uuid(5))).toBe(false);
  });

  it('rejects underpayment and the wrong currency', () => {
    expect(isPaymentAmountValid({ amount: 50, currency: 'usd', metadata })).toBe(false);
    expect(isPaymentAmountValid({ amount: 400, currency: 'twd', metadata })).toBe(false);
  });

  it('rejects a payment with no tokens', () => {
    expect(isPaymentAmountValid({ amount: 400, currency: 'usd', metadata: {} })).toBe(false);
  });
});
