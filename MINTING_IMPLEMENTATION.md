# Document Minting Implementation Summary

## Overview

This document explains the complete implementation of the NFT minting system for academic documents on the Cardano blockchain.

## Architecture Decisions

### Why QStash for All Minting Operations?

**Problem:** Blockchain transactions are:
- **Slow**: Cardano block time is ~20 seconds
- **Irreversible**: Once submitted, cannot be undone
- **Expensive**: Transaction fees are lost even if HTTP request times out
- **Unreliable**: HTTP clients may disconnect before completion

**Solution:** Decouple minting from HTTP request lifecycle using QStash

**Benefits:**
1. ✅ API responds immediately (<100ms)
2. ✅ Supports automatic retries on failure
3. ✅ No HTTP timeouts for blockchain confirmation
4. ✅ User doesn't wait for blockchain (can close browser)
5. ✅ Background processing with status tracking

### Database-Driven Status Tracking

**Why not rely on QStash status?**

QStash tracks job status, but we need to track **blockchain transaction status**:
- A job can succeed but transaction can fail
- A job can succeed but transaction may not confirm
- We need to verify on-chain confirmation before marking as "minted"

**Solution:** Track status in `docq_mint_nfts.status` column

**Status Flow:**
```
pending → minted (after on-chain confirmation)
       → failed (if transaction fails or doesn't confirm)
```

## Implementation Details

### 1. Mint Endpoint (`/api/schools/[schoolId]/documents/mint/route.ts`)

**Responsibilities:**
- Validate request
- Check school has custody wallet
- Get unminted documents
- Create NFT records with `status: 'pending'`
- Enqueue job to QStash
- Return immediately

**Code Flow:**
```typescript
1. Validate documentIds
2. Check school & custody wallet exist
3. Get documents not yet minted
4. FOR EACH document:
     Create NFT record with status='pending'
5. Queue job to QStash with:
   - schoolId
   - documentIds
   - custodyWalletId
   - network
   - pendingNFTIds
6. Return success response immediately
```

**Response Time:** <100ms (no blockchain operations)

### 2. Process Webhook (`/api/schools/[schoolId]/documents/mint/process/route.ts`)

**Responsibilities:**
- Mint NFTs on blockchain
- Wait for transaction confirmation
- Update NFT records with on-chain data
- Handle failures gracefully

**Code Flow:**
```typescript
1. Receive webhook from QStash
2. Get school & document data
3. Call mintDocuments() → returns txHash
4. Verify transaction on-chain:
   RETRY up to 15 times (every 4 seconds):
     - Call provider.fetchTxInfo(txHash)
     - If found → transaction confirmed
     - If not found → wait and retry
5. If confirmed:
     Update NFT records:
       - policy_id, asset_name, metadata
       - tx_hash
       - status = 'minted'
6. If failed:
     Update NFT records:
       - status = 'failed'
       - metadata.error = error message
7. Return response (QStash marks job complete)
```

**Processing Time:** 1-5 minutes (includes blockchain confirmation)

### 3. Transaction Verification

**Why verify on-chain?**

Submitting a transaction to the blockchain does NOT guarantee it's confirmed:
- Transaction could be rejected
- Transaction could be stuck in mempool
- Network could be congested

**Implementation:**
```typescript
async function verifyTransactionOnChain(
  txHash: string,
  network: 'mainnet' | 'preprod',
  maxRetries: number = 15,
  retryDelay: number = 4000
): Promise<boolean> {
  const provider = new BlockfrostProvider(apiKey);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const txInfo = await provider.fetchTxInfo(txHash);
      
      if (txInfo && txInfo.hash === txHash) {
        // ✅ Transaction confirmed on-chain
        return true;
      }
    } catch (error) {
      // Transaction not yet confirmed, wait and retry
      await sleep(retryDelay);
    }
  }
  
  // ❌ Transaction not confirmed after max retries
  return false;
}
```

**Verification Parameters:**
- **Max retries:** 15 attempts
- **Retry delay:** 4 seconds
- **Total wait time:** Up to 60 seconds
- **Blockfrost limitation:** Only confirmed transactions can be retrieved

### 4. Frontend Integration

**DocumentsList Component:**

```typescript
// Show publish status badge
{document.is_published ? (
  <Badge variant="success">Published</Badge>
) : (
  <Badge variant="default">Unpublished</Badge>
)}

// Bulk minting
const handleMintAll = async () => {
  const unmintedIds = unmintedDocuments.map(doc => doc.id);
  await handleMintDocuments(unmintedIds);
};

// Single document minting
const handleMintSingle = async (documentId: string) => {
  await handleMintDocuments([documentId]);
};

// Minting function
const handleMintDocuments = async (documentIds: string[]) => {
  const response = await fetch(`/api/schools/${schoolId}/documents/mint`, {
    method: 'POST',
    body: JSON.stringify({ documentIds }),
  });
  
  const result = await response.json();
  
  // Show user that job is queued
  alert(`Publishing job queued for ${result.documentCount} document(s)!`);
  
  // Refresh to show pending status
  await refetch();
};
```

**User Flow:**
1. Click "Publish All" or rocket icon
2. Confirm action
3. See "Job queued" message
4. Documents show as "Unpublished" (NFT status is 'pending')
5. Wait 1-5 minutes
6. Refresh page
7. Documents now show as "Published" (NFT status is 'minted')

## Database Schema

### NFT Status Values

| Status | Description | When Set |
|--------|-------------|----------|
| `pending` | Minting job queued, not yet submitted | On API request |
| `minted` | Transaction confirmed on-chain | After verification |
| `failed` | Minting failed or didn't confirm | After error/timeout |
| `burned` | NFT has been burned | Future feature |
| `transferred` | NFT transferred to student wallet | Future feature |

### Nullable Fields

These fields are `NULL` when `status = 'pending'`:
- `policy_id` - Set after minting
- `asset_name` - Set after minting
- `tx_hash` - Set after minting
- `metadata_hash` - Optional

### Query Examples

**Get all minted documents:**
```sql
SELECT d.*, n.policy_id, n.asset_name, n.tx_hash
FROM docq_mint_documents d
INNER JOIN docq_mint_nfts n ON d.id = n.document_id
WHERE n.status = 'minted';
```

**Get pending mints:**
```sql
SELECT d.*, n.created_at as queued_at
FROM docq_mint_documents d
INNER JOIN docq_mint_nfts n ON d.id = n.document_id
WHERE n.status = 'pending';
```

**Get failed mints with errors:**
```sql
SELECT d.original_filename, 
       n.status, 
       n.metadata->>'error' as error_message,
       n.tx_hash
FROM docq_mint_nfts n
JOIN docq_mint_documents d ON n.document_id = d.id
WHERE n.status = 'failed';
```

## Error Handling

### Failure Scenarios

1. **Wallet Not Found**
   - Status: Never created
   - Action: User sees error immediately
   
2. **Insufficient Funds**
   - Status: `failed`
   - Error: "Insufficient ADA"
   - Action: Fund wallet and retry
   
3. **Transaction Rejected**
   - Status: `failed`
   - Error: Rejection reason
   - Action: Check error, fix, retry
   
4. **Transaction Not Confirmed**
   - Status: `failed`
   - Error: "Transaction not confirmed after 15 attempts"
   - Action: Check transaction on Cardano explorer

### Retry Strategy

**Automatic Retries:**
- QStash can retry failed webhooks (configurable)
- Transaction verification retries 15 times automatically

**Manual Retries:**
- User can re-click "Publish" button
- Failed NFT records should be deleted/updated before retry

## Testing

### Local Testing with QStash

1. **Start QStash locally:**
   ```bash
   docker run -p 8080:8080 upstash/qstash-local
   ```

2. **Set environment variables:**
   ```bash
   QSTASH_URL=http://localhost:8080
   QSTASH_TOKEN=eyJVc2VySUQiOiJkZWZhdWx0VXNlciIsIlBhc3N3b3JkIjoiZGVmYXVsdFBhc3N3b3JkIn0=
   ```

3. **Test single document mint:**
   ```bash
   curl -X POST http://localhost:3000/api/schools/{schoolId}/documents/mint \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"documentIds": ["doc-uuid"]}'
   ```

4. **Check QStash dashboard:**
   ```
   http://localhost:8080/dashboard
   ```

### Verification Testing

**Mock transaction verification:**
```typescript
// For testing, reduce retry count
await verifyTransactionOnChain(txHash, network, 3, 1000);
```

**Check Blockfrost:**
```typescript
const provider = new BlockfrostProvider(apiKey);
const txInfo = await provider.fetchTxInfo(txHash);
console.log(txInfo);
```

## Monitoring

### Key Metrics

1. **Pending Duration**: Time documents stay in 'pending' status
2. **Success Rate**: % of mints that succeed
3. **Failure Rate**: % of mints that fail
4. **Average Confirmation Time**: Time from submit to confirmed

### SQL Queries for Monitoring

**Pending mints older than 10 minutes:**
```sql
SELECT COUNT(*) as stuck_mints
FROM docq_mint_nfts
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '10 minutes';
```

**Success rate:**
```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM docq_mint_nfts
GROUP BY status;
```

**Average confirmation time:**
```sql
SELECT AVG(updated_at - created_at) as avg_confirmation_time
FROM docq_mint_nfts
WHERE status = 'minted';
```

## Security Considerations

1. **Wallet Security**: Seed phrases encrypted with AES-256-GCM
2. **Access Control**: Only school owners/admins can mint
3. **QStash Verification**: Webhook signature verification (recommended for production)
4. **Database Constraints**: Foreign keys prevent orphaned records
5. **Idempotency**: Duplicate mints prevented by checking existing NFTs

## Future Enhancements

1. [ ] Add retry mechanism for failed mints
2. [ ] Implement QStash signature verification in production
3. [ ] Add webhook for notifying users when minting completes
4. [ ] Support batch minting optimization (multiple NFTs per transaction)
5. [ ] Add monitoring dashboard for mint status
6. [ ] Implement automatic cleanup of old pending/failed records
7. [ ] Add support for canceling pending mints

## Troubleshooting

### Problem: Documents stuck in "pending" status

**Check:**
```sql
SELECT * FROM docq_mint_nfts WHERE status = 'pending' AND created_at < NOW() - INTERVAL '10 minutes';
```

**Solution:**
- Check QStash dashboard for failed jobs
- Check server logs for errors
- Manually trigger webhook if job failed

### Problem: Transaction submitted but not confirmed

**Check Cardano Explorer:**
- Preprod: https://preprod.cardanoscan.io/transaction/{txHash}
- Mainnet: https://cardanoscan.io/transaction/{txHash}

**Solution:**
- If not found: Transaction failed, retry
- If found but rejected: Check error, fix issue
- If found and confirmed: Update NFT status manually

### Problem: "QStash is not configured"

**Check:**
```bash
echo $QSTASH_TOKEN
```

**Solution:**
Set environment variable in `.env.local`

---

**Version:** 1.0.0  
**Last Updated:** 2026-01-12  
**Implementation Status:** ✅ Complete and tested

