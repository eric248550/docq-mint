import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { query, queryOne, getClient } from '@/lib/db/config';
import { getWalletBalanceById } from '@/lib/wallet/cardano';
import { DBDocument, DBSchool, DBNFT } from '@/lib/db/types';
import { debitCreditsTx, estimatedMintLovelace, CreditDocRef } from '@/lib/credits';
import { Client } from '@upstash/qstash';

// Initialize QStash client
const qstashClient = process.env.QSTASH_TOKEN 
  ? new Client({ token: process.env.QSTASH_TOKEN })
  : null;

/**
 * POST /api/schools/:schoolId/documents/mint
 * Mint documents as NFTs on Cardano blockchain
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;
    const { schoolId } = params;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check access - only owner/admin can mint documents
    const hasAccess = await checkSchoolAccess(dbUser.id, schoolId, ['owner', 'admin']);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { documentIds } = body as { documentIds: string[] };

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'documentIds must be a non-empty array' },
        { status: 400 }
      );
    }

    try {
      // Get school info
      const school = await queryOne<DBSchool>(
        'SELECT * FROM docq_mint_schools WHERE id = $1',
        [schoolId]
      );

      if (!school) {
        return NextResponse.json({ error: 'School not found' }, { status: 404 });
      }

      if (!school.custody_wallet_id) {
        return NextResponse.json(
          { error: 'School does not have a custody wallet. Please set up a custody wallet first.' },
          { status: 400 }
        );
      }

      // Get custody wallet info
      const custodyWallet = await queryOne<{ network: string }>(
        'SELECT network FROM docq_mint_wallets WHERE id = $1',
        [school.custody_wallet_id]
      );

      if (!custodyWallet) {
        return NextResponse.json({ error: 'Custody wallet not found' }, { status: 404 });
      }

      // ALL minting operations must be processed via QStash
      // This decouples minting from HTTP request lifecycle and supports retries
      if (!qstashClient) {
        return NextResponse.json(
          { error: 'QStash is not configured. Please set QSTASH_TOKEN environment variable.' },
          { status: 500 }
        );
      }

      // Compute + validate the webhook URL BEFORE touching document state — if this
      // fails (e.g. running locally without NEXT_PUBLIC_APP_URL), nothing should be
      // marked as issued.
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      const webhookUrl = `${baseUrl}/api/schools/${schoolId}/documents/mint/process`;

      if (webhookUrl.includes('localhost') && !process.env.QSTASH_URL?.includes('localhost')) {
        return NextResponse.json(
          { error: 'Production QStash requires a publicly accessible webhook URL. Please set NEXT_PUBLIC_APP_URL environment variable.' },
          { status: 500 }
        );
      }

      // WALLET ADA GATE: the custody wallet must be able to fund the mint. This
      // is the real ADA that mints the docs — credits are just an authorization
      // layer on top, so we verify both before publishing.
      const requiredLovelace = estimatedMintLovelace(documentIds.length);
      let walletLovelace: number;
      try {
        walletLovelace = Number(await getWalletBalanceById(school.custody_wallet_id));
      } catch (balErr) {
        console.error('Failed to verify custody wallet balance:', balErr);
        return NextResponse.json(
          { error: 'Could not verify custody wallet balance. Please try again in a moment.' },
          { status: 503 }
        );
      }

      if (walletLovelace < requiredLovelace) {
        return NextResponse.json(
          {
            error:
              `Insufficient wallet balance to publish. The custody wallet needs ~${(Number(requiredLovelace) / 1_000_000).toFixed(2)} ADA ` +
              `to mint ${documentIds.length} document(s), but only holds ~${(Number(walletLovelace) / 1_000_000).toFixed(2)} ADA.`,
          },
          { status: 400 }
        );
      }

      // Claim documents, create pending NFTs, and debit credits atomically.
      // - issued_at as source of truth prevents double-minting on a double click.
      // - debiting in the same transaction prevents queueing more publishes than
      //   the school can pay for (the credit_balance >= N check is the gate).
      const client = await getClient();
      let documents: DBDocument[] = [];
      const pendingNFTs: string[] = [];
      let earlyResponse: NextResponse | null = null;
      try {
        await client.query('BEGIN');

        const claimRes = await client.query<DBDocument>(
          `UPDATE docq_mint_documents
           SET issued_at = now()
           WHERE id = ANY($1)
           AND school_id = $2
           AND issued_at IS NULL
           RETURNING *`,
          [documentIds, schoolId]
        );
        documents = claimRes.rows;

        if (documents.length === 0) {
          await client.query('ROLLBACK');

          // Check if documents were already issued
          const alreadyIssued = await query<{ id: string; issued_at: Date }>(
            `SELECT id, issued_at FROM docq_mint_documents
             WHERE id = ANY($1) AND school_id = $2 AND issued_at IS NOT NULL`,
            [documentIds, schoolId]
          );

          earlyResponse = alreadyIssued.length > 0
            ? NextResponse.json(
                { error: 'Documents have already been issued', issuedDocuments: alreadyIssued },
                { status: 409 } // Conflict
              )
            : NextResponse.json(
                { error: 'No documents found with provided IDs' },
                { status: 400 }
              );
        } else {
          // Create pending NFT records (updated to 'minted' after confirmation)
          // and build doc→NFT refs for the credit ledger.
          const docRefs: CreditDocRef[] = [];
          for (const doc of documents) {
            const nftRes = await client.query<DBNFT>(
              `INSERT INTO docq_mint_nfts
               (document_id, policy_id, asset_name, metadata, metadata_hash, tx_hash, custody_wallet_id, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING *`,
              [doc.id, '', '', JSON.stringify({}), '', '', school.custody_wallet_id, 'pending']
            );
            const nftId = nftRes.rows[0]?.id ?? null;
            if (nftId) pendingNFTs.push(nftId);
            docRefs.push({ documentId: doc.id, nftId });
          }

          // CREDIT GATE: debit one credit per claimed document. Rolls back the
          // whole publish (releasing the doc claim) if the school can't afford it.
          const newBalance = await debitCreditsTx(client, {
            schoolId,
            documents: docRefs,
            createdBy: dbUser.id,
          });

          if (newBalance === null) {
            await client.query('ROLLBACK');
            earlyResponse = NextResponse.json(
              {
                error:
                  `Insufficient credits. Publishing ${documents.length} document(s) requires ${documents.length} credit(s). ` +
                  `Please contact your administrator to top up credits.`,
              },
              { status: 402 } // Payment Required
            );
          } else {
            await client.query('COMMIT');
          }
        }
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

      if (earlyResponse) return earlyResponse;

      // Queue the minting job (outside the transaction). If queuing fails, the
      // mint will never run, so fully compensate the committed transaction:
      // remove the debit ledger rows + pending NFTs, restore the credits, and
      // release the document claim.
      try {
        console.log(`📤 Queuing minting job to: ${webhookUrl}`);

        await qstashClient.publishJSON({
          url: webhookUrl,
          body: {
            schoolId,
            documentIds: documents.map(d => d.id),
            custodyWalletId: school.custody_wallet_id,
            network: custodyWallet.network,
            pendingNFTIds: pendingNFTs,
          },
        });
      } catch (queueError) {
        console.error('Failed to queue minting job, compensating:', queueError);
        if (pendingNFTs.length > 0) {
          // Debit ledger rows reference these NFTs — remove them first.
          await query(`DELETE FROM docq_mint_credit_transactions WHERE nft_id = ANY($1)`, [pendingNFTs]);
          await query(`DELETE FROM docq_mint_nfts WHERE id = ANY($1)`, [pendingNFTs]);
        }
        await query(
          `UPDATE docq_mint_schools SET credit_balance = credit_balance + $2 WHERE id = $1`,
          [schoolId, documents.length]
        );
        await query(
          `UPDATE docq_mint_documents SET issued_at = NULL WHERE id = ANY($1)`,
          [documents.map(d => d.id)]
        );
        throw queueError;
      }

      return NextResponse.json({
        success: true,
        message: `Minting job queued for ${documents.length} document(s). The process will complete in the background.`,
        queued: true,
        documentCount: documents.length,
        pendingNFTs,
      });
    } catch (error) {
      console.error('Failed to mint documents:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: `Failed to publish documents: ${errorMessage}` },
        { status: 500 }
      );
    }
  });
}
