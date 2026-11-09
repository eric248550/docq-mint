import jwt from 'jsonwebtoken';
import { createAccessGrant, getGrantedPaymentId } from '@/lib/verify/access-grant';

describe('verification access grant', () => {
  const secret = 'test-secret';

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
  });

  it('returns the payment for the document it was issued for', () => {
    expect(getGrantedPaymentId(createAccessGrant('token-1', 'payment-1'), 'token-1')).toBe('payment-1');
  });

  it('rejects a grant for another document', () => {
    expect(getGrantedPaymentId(createAccessGrant('token-1', 'payment-1'), 'token-2')).toBeNull();
  });

  it('rejects a missing or malformed grant', () => {
    expect(getGrantedPaymentId(null, 'token-1')).toBeNull();
    expect(getGrantedPaymentId('not-a-jwt', 'token-1')).toBeNull();
  });

  it('rejects a grant signed with another secret', () => {
    const forged = jwt.sign({ tokenId: 'token-1', paymentId: 'p', type: 'verification_access' }, 'other');
    expect(getGrantedPaymentId(forged, 'token-1')).toBeNull();
  });

  it('rejects other JWT types signed with the same secret', () => {
    const invite = jwt.sign({ tokenId: 'token-1', paymentId: 'p', type: 'invite' }, secret);
    expect(getGrantedPaymentId(invite, 'token-1')).toBeNull();
  });
});
