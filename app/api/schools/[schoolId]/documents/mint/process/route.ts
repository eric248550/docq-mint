import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/config';
import { mintDocuments } from '@/lib/wallet/cardano';
import { DBDocument, DBSchool, DBNFT } from '@/lib/db/types';
import { BlockfrostProvider } from '@meshsdk/core';

// Helper function to verify transaction on-chain
// Polls Blockfrost until transaction is confirmed
// Cardano block time is ~20 seconds, so we retry multiple times with delays
async function verifyTransactionOnChain(
  txHash: string,
  network: 'mainnet' | 'preprod',
  maxRetries: number = 15,
  retryDelay: number = 4000
): Promise<boolean> {
  const apiKey = process.env.BLOCKFROST_API_KEY;
  if (!apiKey) {
    throw new Error('BLOCKFROST_API_KEY not configured');
  }

  const provider = new BlockfrostProvider(apiKey);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Only confirmed transactions can be retrieved
      const txInfo = await provider.fetchTxInfo(txHash);
      
      if (txInfo && txInfo.hash === txHash) {
        console.log(`✅ Transaction confirmed on-chain: ${txHash}`);
        console.log(`   Block: ${txInfo.blockHeight}, Slot: ${txInfo.slot}`);
        return true;
      }
    } catch (error) {
      console.log(`⏳ Attempt ${attempt + 1}/${maxRetries}: Transaction not yet confirmed`);
      
      // If it's the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw new Error(`Transaction not confirmed after ${maxRetries} attempts`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  return false;
}

/**
 * POST /api/schools/:schoolId/documents/mint/process
 * Process queued minting job (called by QStash webhook)
 */
async function handler(
  body: any,
  { params }: { params: { schoolId: string } }
) {
  let txHash: string | null = null;
  let pendingNFTIds: string[] = [];

  try {
    const { schoolId, documentIds, custodyWalletId, network, pendingNFTIds: nftIds } = body;
    pendingNFTIds = nftIds || [];

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      throw new Error('documentIds must be a non-empty array');
    }

    // Get school info
    const school = await queryOne<DBSchool>(
      'SELECT * FROM docq_mint_schools WHERE id = $1',
      [schoolId]
    );

    if (!school) {
      throw new Error('School not found');
    }

    // Get documents to mint
    const documents = await query<DBDocument>(
      `SELECT d.* FROM docq_mint_documents d
       WHERE d.id = ANY($1) 
       AND d.school_id = $2`,
      [documentIds, schoolId]
    );

    if (documents.length === 0) {
      throw new Error('No documents found to mint');
    }

    console.log(`🚀 Starting minting process for ${documents.length} document(s)...`);

    // Mint documents on blockchain
    const mintResult = await mintDocuments({
      custodyWalletId,
      documents: documents.map(doc => ({
        id: doc.id,
        file_hash: doc.file_hash,
        document_type: doc.document_type,
        original_filename: doc.original_filename,
        student_id: doc.student_id,
      })),
      schoolInfo: {
        id: school.id,
        name: school.name,
        country_code: school.country_code,
      },
      network: network as 'mainnet' | 'preprod',
    });

    txHash = mintResult.txHash;
    console.log(`📝 Transaction submitted: ${txHash}`);

    // Verify transaction is confirmed on-chain
    console.log('⏳ Waiting for on-chain confirmation...');
    const isConfirmed = await verifyTransactionOnChain(txHash, network, 15, 4000);

    if (!isConfirmed) {
      throw new Error('Transaction not confirmed on-chain within timeout period');
    }

    // Update NFT records with actual data and mark as 'minted'
    for (let i = 0; i < mintResult.nfts.length; i++) {
      const nft = mintResult.nfts[i];
      const pendingNFTId = pendingNFTIds[i];

      if (pendingNFTId) {
        // Update existing pending record
        await queryOne(
          `UPDATE docq_mint_nfts 
           SET policy_id = $1,
               asset_name = $2,
               metadata = $3,
               tx_hash = $4,
               status = $5,
               updated_at = now()
           WHERE id = $6`,
          [
            nft.policyId,
            nft.assetName,
            JSON.stringify(nft.metadata),
            txHash,
            'minted',
            pendingNFTId,
          ]
        );
      } else {
        // Create new record (fallback)
        await queryOne<DBNFT>(
          `INSERT INTO docq_mint_nfts 
           (document_id, policy_id, asset_name, metadata, metadata_hash, tx_hash, custody_wallet_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            nft.documentId,
            nft.policyId,
            nft.assetName,
            JSON.stringify(nft.metadata),
            '',
            txHash,
            custodyWalletId,
            'minted',
          ]
        );
      }
    }

    console.log(`✅ Successfully minted ${mintResult.nfts.length} document(s)`);

    return NextResponse.json({
      success: true,
      txHash,
      mintedCount: mintResult.nfts.length,
      confirmed: true,
    });
  } catch (error) {
    console.error('❌ Failed to process minting job:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Mark pending NFTs as failed
    if (pendingNFTIds.length > 0) {
      for (const nftId of pendingNFTIds) {
        await queryOne(
          `UPDATE docq_mint_nfts 
           SET status = $1, 
               tx_hash = $2,
               metadata = jsonb_set(metadata, '{error}', to_jsonb($3::text)),
               updated_at = now()
           WHERE id = $4`,
          ['failed', txHash || '', errorMessage, nftId]
        );
      }
    }

    // Return error but with 200 status so QStash doesn't retry
    // (we've already marked as failed in DB)
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        txHash,
      },
      { status: 200 }
    );
  }
}


/**
 * POST handler with signature verification
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  // Read the body once
  const bodyText = await request.text();
  
  // Verify QStash signature (if not in local mode)
  if (!process.env.QSTASH_URL?.includes('localhost')) {
    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

    if (!currentSigningKey || !nextSigningKey) {
      return NextResponse.json(
        { error: 'QStash signing keys not configured' },
        { status: 500 }
      );
    }

    try {
      const { Receiver } = await import('@upstash/qstash');
      const receiver = new Receiver({
        currentSigningKey,
        nextSigningKey,
      });

      const signature = request.headers.get('upstash-signature');
      if (!signature) {
        return NextResponse.json(
          { error: 'Missing upstash-signature header' },
          { status: 401 }
        );
      }

      await receiver.verify({
        signature,
        body: bodyText,
      });

      console.log('✅ QStash signature verified');
    } catch (error) {
      console.error('❌ QStash signature verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }
  } else {
    console.log('🔓 Local mode: Skipping signature verification');
  }

  // Parse body and call handler
  const body = JSON.parse(bodyText);
  return handler(body, { params });
}

