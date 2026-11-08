export const PRICE_PER_DOCUMENT_CENTS = 200;
export const PAYMENT_CURRENCY = 'usd';
export const MAX_DOCUMENTS_PER_PAYMENT = 100;

// Stripe limits a metadata value to 500 characters: 13 UUIDs plus commas fit.
const TOKEN_IDS_PER_METADATA_FIELD = 13;
const LEGACY_FIELD = 'token_ids';
const FIELD_PREFIX = 'token_ids_';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function tokenIdsToMetadata(tokenIds: string[]): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (let i = 0; i * TOKEN_IDS_PER_METADATA_FIELD < tokenIds.length; i++) {
    const start = i * TOKEN_IDS_PER_METADATA_FIELD;
    metadata[`${FIELD_PREFIX}${i}`] = tokenIds.slice(start, start + TOKEN_IDS_PER_METADATA_FIELD).join(',');
  }
  return metadata;
}

/** Also reads the single token_ids field used by payments created earlier. */
export function tokenIdsFromMetadata(metadata: Record<string, string> | null | undefined): string[] {
  if (!metadata) return [];
  const values = Object.keys(metadata)
    .filter((key) => key === LEGACY_FIELD || key.startsWith(FIELD_PREFIX))
    .map((key) => metadata[key]);
  return values.flatMap((value) => value.split(',')).filter(Boolean);
}

export interface PaymentDetails {
  amount: number;
  currency: string;
  metadata?: Record<string, string> | null;
}

/** The payment must be in the right currency and cover every document it lists. */
export function isPaymentAmountValid(payment: PaymentDetails): boolean {
  const tokenCount = tokenIdsFromMetadata(payment.metadata).length;
  return (
    tokenCount > 0 &&
    payment.currency === PAYMENT_CURRENCY &&
    payment.amount >= tokenCount * PRICE_PER_DOCUMENT_CENTS
  );
}

export function paymentCoversToken(payment: PaymentDetails, tokenId: string): boolean {
  return isPaymentAmountValid(payment) && tokenIdsFromMetadata(payment.metadata).includes(tokenId);
}
