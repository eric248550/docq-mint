import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db/config';
import { getOptionalDbUser } from '@/lib/middleware/auth';
import { getGrantedPaymentId } from '@/lib/verify/access-grant';
import { ACCESS_GRANT_HEADER } from '@/lib/verify/grant-storage';

/**
 * A caller has paid access to a document if they hold the payment's grant,
 * made the payment while logged in, or belong to the verifier org it was for.
 */
export async function hasVerificationAccess(
  request: NextRequest,
  tokenId: string
): Promise<boolean> {
  const paymentId = getGrantedPaymentId(request.headers.get(ACCESS_GRANT_HEADER), tokenId);
  const dbUser = await getOptionalDbUser(request);
  if (!paymentId && !dbUser) return false;

  const access = await queryOne<{ id: string }>(
    `SELECT va.id FROM docq_mint_verification_access va
     JOIN docq_mint_payments p ON p.id = va.payment_id
     WHERE va.token_id = $1
       AND p.status = 'succeeded'
       AND (
         va.payment_id = $2::uuid
         OR p.payer_user_id = $3::uuid
         OR va.verifier_id IN (
           SELECT verifier_id FROM docq_mint_verifier_memberships
           WHERE user_id = $3::uuid AND status = 'active'
         )
       )
     LIMIT 1`,
    [tokenId, paymentId, dbUser?.id ?? null]
  );
  return !!access;
}
