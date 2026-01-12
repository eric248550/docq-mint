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

      // Get documents to mint
      const documents = await query<DBDocument>(
        `SELECT d.* FROM docq_mint_documents d
         LEFT JOIN docq_mint_nfts n ON d.id = n.document_id AND n.status = 'minted'
         WHERE d.id = ANY($1) 
         AND d.school_id = $2
         AND n.id IS NULL`,
        [documentIds, schoolId]
      );

      if (documents.length === 0) {
        return NextResponse.json(
          { error: 'No unminted documents found with provided IDs' },
          { status: 400 }
        );
      }

      // ALL minting operations must be processed via QStash
      // This decouples minting from HTTP request lifecycle and supports retries
      if (!qstashClient) {
        return NextResponse.json(
          { error: 'QStash is not configured. Please set QSTASH_TOKEN environment variable.' },
          { status: 500 }
        );
      }

      // Create pending NFT records in database
      // These will be updated to 'minted' after on-chain confirmation
      const pendingNFTs: string[] = [];
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

      // Queue the minting job
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      const webhookUrl = `${baseUrl}/api/schools/${schoolId}/documents/mint/process`;
      
      // Validate webhook URL is publicly accessible
      if (webhookUrl.includes('localhost') && !process.env.QSTASH_URL?.includes('localhost')) {
        return NextResponse.json(
          { error: 'Production QStash requires a publicly accessible webhook URL. Please set NEXT_PUBLIC_APP_URL environment variable.' },
          { status: 500 }
        );
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
