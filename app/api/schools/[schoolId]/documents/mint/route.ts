import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkSchoolAccess } from '@/lib/middleware/auth';
import { query, queryOne } from '@/lib/db/config';
import { mintDocuments } from '@/lib/wallet/cardano';
import { DBDocument, DBSchool, DBNFT } from '@/lib/db/types';
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

      // CRITICAL: Use issued_at as source of truth to prevent double-minting
      // Atomically mark documents as issued and retrieve them in one query
      // This prevents race condition if user clicks "Publish" twice
      const documents = await query<DBDocument>(
        `UPDATE docq_mint_documents
         SET issued_at = now()
         WHERE id = ANY($1) 
         AND school_id = $2
         AND issued_at IS NULL
         RETURNING *`,
        [documentIds, schoolId]
      );

      if (documents.length === 0) {
        // Check if documents were already issued
        const alreadyIssued = await query<{ id: string; issued_at: Date }>(
          `SELECT id, issued_at FROM docq_mint_documents
           WHERE id = ANY($1) AND school_id = $2 AND issued_at IS NOT NULL`,
          [documentIds, schoolId]
        );

        if (alreadyIssued.length > 0) {
          return NextResponse.json(
            { 
              error: 'Documents have already been issued',
              issuedDocuments: alreadyIssued 
            },
            { status: 409 } // Conflict
          );
        }

        return NextResponse.json(
          { error: 'No documents found with provided IDs' },
          { status: 400 }
        );
      }

      // From this point on, documents are marked as issued. If anything below fails,
      // we must roll that back so documents don't end up "published" with no NFT job.
      const pendingNFTs: string[] = [];
      try {
        // Create pending NFT records in database
        // These will be updated to 'minted' after on-chain confirmation
        for (const doc of documents) {
          const nftRecord = await queryOne<DBNFT>(
            `INSERT INTO docq_mint_nfts 
             (document_id, policy_id, asset_name, metadata, metadata_hash, tx_hash, custody_wallet_id, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
              doc.id,
              '', // Will be set after minting
              '', // Will be set after minting
              JSON.stringify({}), // Will be set after minting
              '',
              '', // Will be set after minting
              school.custody_wallet_id,
              'pending',
            ]
          );
          if (nftRecord) {
            pendingNFTs.push(nftRecord.id);
          }
        }

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
        // Roll back: unmark issued_at and remove any pending NFT records we created,
        // since the minting job never actually got queued.
        const documentIssuedIds = documents.map(d => d.id);
        await query(
          `UPDATE docq_mint_documents SET issued_at = NULL WHERE id = ANY($1)`,
          [documentIssuedIds]
        );
        if (pendingNFTs.length > 0) {
          await query(`DELETE FROM docq_mint_nfts WHERE id = ANY($1)`, [pendingNFTs]);
        }
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
