import jwt from 'jsonwebtoken';

interface AccessGrantPayload {
  tokenId: string;
  paymentId: string;
  type: 'verification_access';
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
}

/**
 * Proof that the browser holding it completed this payment for this document.
 * It has no expiry of its own: every route checks the share link's expires_at.
 */
export function createAccessGrant(tokenId: string, paymentId: string): string {
  const payload: AccessGrantPayload = { tokenId, paymentId, type: 'verification_access' };
  return jwt.sign(payload, getSecret(), { algorithm: 'HS256' });
}

/** Returns the payment the grant proves for this document, or null. */
export function getGrantedPaymentId(grant: string | null, tokenId: string): string | null {
  if (!grant) return null;
  try {
    const decoded = jwt.verify(grant, getSecret(), { algorithms: ['HS256'] }) as AccessGrantPayload;
    if (decoded.type !== 'verification_access' || decoded.tokenId !== tokenId) return null;
    return decoded.paymentId;
  } catch {
    return null;
  }
}
