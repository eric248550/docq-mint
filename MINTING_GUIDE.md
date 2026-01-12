# Document Minting Guide

This guide explains how to mint (publish) documents to the Cardano blockchain as NFTs.

## Overview

The document minting system allows schools to publish academic documents to the blockchain, creating an immutable, verifiable record. Documents can be minted individually or in bulk.

## Features

### For Issuers (School Admins)

1. **Publish Status Badge**: Each document shows whether it has been published to the blockchain
   - 🟢 **Published**: Document has been minted as an NFT
   - ⚪ **Unpublished**: Document has not yet been minted

2. **Bulk Publishing**: Mint multiple documents in a single transaction
   - Click "Publish All" button to mint all unpublished documents
   - Large batches (>5 documents) are automatically queued via QStash

3. **Individual Publishing**: Mint a single document
   - Click the rocket 🚀 icon on any unpublished document

### For Students

- Only **published** documents appear in the student dashboard
- Unpublished documents remain hidden from students until they are minted

## Technical Implementation

### Architecture

```
┌─────────────────┐
│ School Admin UI │
└────────┬────────┘
         │ Mint Request
         ▼
┌──────────────────────────┐
│ Mint API Endpoint        │
│ - Creates pending NFTs   │
│ - Enqueues job           │
│ - Returns immediately    │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ QStash Queue             │ (ALL operations)
│ - Decouples from HTTP    │
│ - Supports retries       │
│ - Avoids timeouts        │
└────────┬─────────────────┘
         │ Webhook
         ▼
┌──────────────────────────┐
│ Process Webhook          │
│ 1. Mint via MeshJS       │
│ 2. Get txHash            │
│ 3. Verify on-chain       │
│ 4. Update NFT status     │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Cardano Blockchain       │
│ - Submit transaction     │
│ - Wait for confirmation  │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Database                 │
│ - pending → minted       │
│ - or → failed            │
└──────────────────────────┘
```

**Key Design Principles:**

1. **All minting is async via QStash** - Even single documents go through the queue
2. **Immediate API response** - Users don't wait for blockchain confirmation
3. **On-chain verification** - Transaction must be confirmed before marking as "minted"
4. **Database-driven status** - Status tracked in `docq_mint_nfts.status`, not QStash
5. **Failure handling** - Failed mints are marked in DB with error details

### NFT Metadata Structure

Each minted document includes:

```typescript
{
  name: string;                    // Document filename or type
  description: string;             // "Academic document issued by [School]"
  image: string;                   // Placeholder image (IPFS)
  mediaType: "application/pdf";
  files: [{
    name: string;
    mediaType: "application/pdf";
    src: string;                   // File hash (SHA-256)
  }],
  attributes: {
    documentType: string;          // report_card, transcript, etc.
    fileHash: string;              // SHA-256 hash for verification
    issuer: string;                // School name
    issuerId: string;              // School UUID
    countryCode: string;           // ISO country code
    issuedDate: string;            // ISO timestamp
    documentId: string;            // Document UUID
  }
}
```

### API Endpoints

#### Mint Documents

**POST** `/api/schools/[schoolId]/documents/mint`

Request body:
```json
{
  "documentIds": ["uuid-1", "uuid-2", "..."]
}
```

Response (all operations are queued):
```json
{
  "success": true,
  "message": "Minting job queued for 2 document(s). The process will complete in the background.",
  "queued": true,
  "documentCount": 2,
  "pendingNFTs": ["uuid-1", "uuid-2"]
}
```

The API creates NFT records with `status: 'pending'` and immediately returns.
The actual minting happens asynchronously via QStash webhook.

#### Process Queued Minting (Webhook)

**POST** `/api/schools/[schoolId]/documents/mint/process`

Called automatically by QStash for bulk operations.

## Environment Variables

Add these to your `.env.local` file:

```bash
# QStash Configuration (for minting)
QSTASH_URL="https://qstash.upstash.io"
QSTASH_TOKEN=your_token_here
QSTASH_CURRENT_SIGNING_KEY=your_current_key
QSTASH_NEXT_SIGNING_KEY=your_next_key

# Cardano Configuration
BLOCKFROST_API_KEY=your_blockfrost_key
SEED_ENCRYPT_KEY=your_32_character_encryption_key

# App URL (for webhooks)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Database Schema

### docq_mint_nfts Table

```sql
CREATE TABLE docq_mint_nfts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id        UUID NOT NULL REFERENCES docq_mint_documents(id),
  policy_id          TEXT,                    -- set after minting
  asset_name         TEXT,                    -- set after minting
  metadata           JSONB NOT NULL,
  metadata_hash      TEXT,
  tx_hash            TEXT,                    -- set after minting
  ipfs_hash          TEXT,
  custody_wallet_id  UUID REFERENCES docq_mint_wallets(id),
  status             TEXT NOT NULL,  -- 'pending' | 'minted' | 'failed' | 'burned' | 'transferred'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**NFT Status Lifecycle:**

1. **`pending`** - NFT record created, minting queued but not yet submitted
2. **`minted`** - Transaction confirmed on-chain (via `fetchTxInfo`)
3. **`failed`** - Minting failed (error stored in metadata.error)
4. **`burned`** - NFT has been burned
5. **`transferred`** - NFT transferred to student wallet

## Usage Flow

### 1. Upload Documents

School admins upload documents through the UI.

### 2. Assign to Students (Optional)

Documents can be assigned to specific students or left unassigned.

### 3. Mint Documents

**Option A: Single Document**
- Click the rocket 🚀 icon next to a document
- Confirm the action
- NFT record created with `status: 'pending'`
- Job queued to QStash
- Returns immediately

**Option B: Bulk Minting**
- Click "Publish All" button
- Confirm the action
- NFT records created with `status: 'pending'`
- Job queued to QStash
- Returns immediately

**Background Processing (QStash Webhook):**
1. Minting transaction submitted to blockchain
2. Wait for transaction confirmation (polls `fetchTxInfo`)
3. Once confirmed, update NFT status to `'minted'`
4. If fails, update status to `'failed'` with error details

### 4. Students View Published Documents

Once minted AND confirmed on-chain, documents automatically appear in student dashboards.

**Note:** There may be a delay (1-5 minutes) between initiating mint and documents appearing, as the system waits for blockchain confirmation.

## Blockchain Details

- **Blockchain**: Cardano
- **Network**: Preprod (testnet) or Mainnet
- **Token Standard**: CIP-25 (NFT Metadata Standard)
- **Policy**: Single-signature policy using custody wallet
- **Asset Quantity**: 1 (NFT)
- **Recipient**: School's custody wallet (holds NFTs until claimed)

## Security Features

1. **Access Control**: Only school owners/admins can mint documents
2. **Wallet Security**: Seed phrases encrypted with AES-256-GCM
3. **Immutability**: Once minted, documents cannot be altered
4. **Verification**: File hash stored in metadata for verification
5. **QStash Signature Verification**: Webhook requests are verified

## Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "QStash is not configured" | QSTASH_TOKEN not set | Set QSTASH_TOKEN environment variable |
| "School does not have a custody wallet" | No custody wallet set up | Create a custody wallet for the school first |
| "No unminted documents found" | Documents already minted | Check document status badges |
| "Failed to load custody wallet" | Wallet decryption failed | Verify SEED_ENCRYPT_KEY is correct |
| "Insufficient funds" | Not enough ADA in custody wallet | Fund the custody wallet with ADA |
| "Transaction not confirmed" | Blockchain confirmation timeout | Check transaction hash on Cardano explorer |

### Checking Failed Mints

Query the database to see failed mints:

```sql
SELECT d.original_filename, n.status, n.metadata->>'error' as error_message
FROM docq_mint_nfts n
JOIN docq_mint_documents d ON n.document_id = d.id
WHERE n.status = 'failed';
```

## Testing

For development/testing:

1. Use **Preprod** network (testnet)
2. Get free test ADA from [Cardano Faucet](https://docs.cardano.org/cardano-testnet/tools/faucet/)
3. Fund your custody wallet with test ADA
4. Mint test documents

## Future Enhancements

- [ ] IPFS integration for document storage
- [ ] Batch minting optimization
- [ ] NFT transfer to student wallets
- [ ] Document revocation (burning)
- [ ] Multi-signature policies
- [ ] Custom NFT artwork per document type

## Support

For issues or questions:
- Check the error messages in the console
- Verify environment variables are set correctly
- Ensure custody wallet has sufficient ADA balance
- Check Blockfrost API status

---

**Note**: Minting requires ADA for transaction fees. Ensure custody wallets are funded before attempting to mint documents.

