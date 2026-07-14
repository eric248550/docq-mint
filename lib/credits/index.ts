import { PoolClient } from 'pg';
import { getClient } from '@/lib/db/config';
import { CreditTransactionType } from '@/lib/db/types';

/**
 * File-publishing credits.
 *
 * 1 credit = 1 document minted on-chain. Admins grant credits to a school
 * (docq_mint_schools.credit_balance); publishing debits them. The on-chain mint
 * still spends ADA from the school's custody wallet exactly as before — credits
 * are purely an authorization/billing layer on top.
 */

// Estimated on-chain cost used to pre-check that the custody wallet can fund a
// mint before we debit credits / queue the job:
//   requiredAda = 1.75 + nftCount * 0.25
// 1 ADA = 1,000,000 lovelace. Plain numbers are safe here: a custody wallet's
// balance is far below Number.MAX_SAFE_INTEGER.
export const BASE_FEE_LOVELACE = 1_750_000;    // 1.75 ADA base
export const ADA_PER_DOC_LOVELACE = 250_000;   // 0.25 ADA per NFT

/** Estimated lovelace required to mint `nftCount` documents in one transaction. */
export function estimatedMintLovelace(nftCount: number): number {
  return BASE_FEE_LOVELACE + ADA_PER_DOC_LOVELACE * nftCount;
}

export interface CreditDocRef {
  documentId: string;
  nftId: string | null;
}

/**
 * Atomically debit one credit per document from a school and write one debit
 * ledger row per document. MUST be called inside a transaction (pass the tx
 * client) so the debit is committed together with the doc claim + NFT inserts.
 *
 * Returns the school's new balance, or null if it has insufficient credits
 * (in which case nothing is written and the caller should roll back).
 */
export async function debitCreditsTx(
  client: PoolClient,
  params: { schoolId: string; documents: CreditDocRef[]; createdBy: string | null; note?: string }
): Promise<number | null> {
  const { schoolId, documents, createdBy, note } = params;
  const count = documents.length;
  if (count === 0) return null;

  // Atomic gate: only succeeds if the school can afford the whole batch.
  const res = await client.query<{ credit_balance: number }>(
    `UPDATE docq_mint_schools
     SET credit_balance = credit_balance - $2
     WHERE id = $1 AND credit_balance >= $2
     RETURNING credit_balance`,
    [schoolId, count]
  );
  if (res.rows.length === 0) return null; // insufficient credits

  const finalBalance = res.rows[0].credit_balance;
  for (let i = 0; i < count; i++) {
    // Reconstruct the running balance for each row from the final balance.
    const balanceAfter = finalBalance + (count - 1 - i);
    await client.query(
      `INSERT INTO docq_mint_credit_transactions
        (school_id, amount, type, balance_after, document_id, nft_id, note, created_by)
       VALUES ($1, -1, 'debit', $2, $3, $4, $5, $6)`,
      [schoolId, balanceAfter, documents[i].documentId, documents[i].nftId, note ?? null, createdBy]
    );
  }
  return finalBalance;
}

/**
 * Refund one credit per document (e.g. when an on-chain mint fails). Opens its
 * own transaction. Returns the school's new balance.
 */
export async function refundCredits(params: {
  schoolId: string;
  documents: CreditDocRef[];
  note?: string;
}): Promise<number> {
  const { schoolId, documents, note } = params;
  const count = documents.length;
  if (count === 0) return 0;

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const res = await client.query<{ credit_balance: number }>(
      `UPDATE docq_mint_schools
       SET credit_balance = credit_balance + $2
       WHERE id = $1
       RETURNING credit_balance`,
      [schoolId, count]
    );
    const finalBalance = res.rows[0]?.credit_balance ?? 0;
    for (let i = 0; i < count; i++) {
      const balanceAfter = finalBalance - i; // running balance descending from final
      await client.query(
        `INSERT INTO docq_mint_credit_transactions
          (school_id, amount, type, balance_after, document_id, nft_id, note, created_by)
         VALUES ($1, 1, 'refund', $2, $3, $4, $5, NULL)`,
        [schoolId, balanceAfter, documents[i].documentId, documents[i].nftId, note ?? 'Mint failed refund']
      );
    }
    await client.query('COMMIT');
    return finalBalance;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Grant (or adjust) a school's credits. Positive `amount` adds credits;
 * a negative amount with type 'adjustment' removes them (blocked by the
 * credit_balance >= 0 CHECK constraint, which throws on overdraw).
 */
export async function grantCredits(params: {
  schoolId: string;
  amount: number;
  createdBy: string | null;
  note?: string;
  type?: CreditTransactionType;
}): Promise<number> {
  const { schoolId, amount, createdBy, note } = params;
  const type = params.type ?? 'grant';

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const res = await client.query<{ credit_balance: number }>(
      `UPDATE docq_mint_schools
       SET credit_balance = credit_balance + $2
       WHERE id = $1
       RETURNING credit_balance`,
      [schoolId, amount]
    );
    if (res.rows.length === 0) {
      throw new Error('School not found');
    }
    const finalBalance = res.rows[0].credit_balance;
    await client.query(
      `INSERT INTO docq_mint_credit_transactions
        (school_id, amount, type, balance_after, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [schoolId, amount, type, finalBalance, note ?? null, createdBy]
    );
    await client.query('COMMIT');
    return finalBalance;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
