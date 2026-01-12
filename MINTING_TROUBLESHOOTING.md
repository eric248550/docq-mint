# Minting Troubleshooting Guide

## Error: "bech32.decode input: string expected"

### Cause
This error occurs when MeshJS receives an invalid or empty wallet address when trying to mint NFTs.

### Solution Applied

Updated `lib/wallet/cardano.ts` with the following fixes:

#### 1. **Proper Async Address Retrieval**
```typescript
// Before (incorrect - missing await):
const walletAddress = meshWallet.getChangeAddress();

// After (correct - with await):
const walletAddress = await meshWallet.getChangeAddress();
```

#### 2. **Address Validation & Fallback**
```typescript
let walletAddress: string;

// Try to get the change address first
walletAddress = await meshWallet.getChangeAddress();

// Fallback to used addresses if change address is invalid
if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.trim() === '') {
  const usedAddresses = await meshWallet.getUsedAddresses();
  walletAddress = usedAddresses[0];
}

// Validate it's a valid Cardano address
if (!walletAddress.startsWith('addr')) {
  throw new Error(`Invalid Cardano address format: ${walletAddress}`);
}
```

#### 3. **Enhanced Wallet Loading Verification**
```typescript
// After loading wallet, verify the address
const loadedAddress = await meshWallet.getChangeAddress();
console.log(`✅ Wallet loaded successfully: ${loadedAddress}`);

// Compare with stored address
if (loadedAddress !== wallet.address) {
  console.warn(`⚠️  Address mismatch detected`);
}
```

#### 4. **Mnemonic Validation**
```typescript
// Validate mnemonic before using it
if (mnemonic.length !== 24 && mnemonic.length !== 12 && mnemonic.length !== 15) {
  throw new Error(`Invalid mnemonic length: ${mnemonic.length} words`);
}
```

## Testing the Fix

### 1. Check Wallet Address in Database
```sql
SELECT id, address, network 
FROM docq_mint_wallets 
WHERE id = 'your-wallet-id';
```

Expected output:
- `address` should start with `addr_test` (preprod) or `addr` (mainnet)
- `network` should match your configuration

### 2. Test Wallet Loading
Create a test script:

```typescript
import { loadWalletFromDatabase } from '@/lib/wallet/cardano';

async function testWallet() {
  const walletId = 'your-wallet-id';
  const wallet = await loadWalletFromDatabase(walletId, 'preprod');
  
  if (wallet) {
    const address = await wallet.getChangeAddress();
    console.log('Address:', address);
    console.log('Valid:', address && address.startsWith('addr'));
  }
}

testWallet();
```

### 3. Check Logs During Minting

When minting, you should see:

```
🔐 Loading wallet: wallet-id
   Network: preprod
   Expected address: addr_test1...
✅ Wallet loaded successfully: addr_test1...
✅ Using wallet address: addr_test1...
📝 Transaction submitted: tx_hash...
```

If you see:
```
⚠️  Loaded address doesn't match stored address
```

This indicates a mismatch between the stored address and the derived address. This can happen if:
1. Wrong network specified (preprod vs mainnet)
2. Wrong encryption key used
3. Corrupted seed phrase in database

## Common Issues

### Issue 1: Empty Address
**Symptoms:** Error mentions "string expected" or address is empty

**Fix:** 
- Ensure `await` is used when calling `getChangeAddress()`
- Check wallet was properly initialized with `await wallet.init()`

### Issue 2: Wrong Network
**Symptoms:** Address format doesn't match expected network

**Fix:**
```typescript
// Preprod addresses start with: addr_test
// Mainnet addresses start with: addr
```

Verify network in database matches the network parameter:
```sql
UPDATE docq_mint_wallets 
SET network = 'preprod' 
WHERE id = 'wallet-id';
```

### Issue 3: Seed Phrase Decryption Failure
**Symptoms:** Wallet loads but address is incorrect

**Fix:**
- Verify `SEED_ENCRYPT_KEY` environment variable is correct
- Check the key hasn't changed since wallet creation
- The key must be exactly 32 characters

### Issue 4: MeshWallet Not Initialized
**Symptoms:** Methods return undefined or throw errors

**Fix:**
```typescript
const wallet = new MeshWallet({ ... });
await wallet.init(); // ← Don't forget this!
```

## Prevention

### Best Practices

1. **Always validate addresses**
   ```typescript
   if (!address || !address.startsWith('addr')) {
     throw new Error('Invalid address');
   }
   ```

2. **Add comprehensive logging**
   ```typescript
   console.log('Loading wallet...');
   console.log('Address:', address);
   console.log('Network:', network);
   ```

3. **Test wallet loading before minting**
   ```typescript
   const wallet = await loadWalletFromDatabase(id, network);
   const address = await wallet.getChangeAddress();
   console.assert(address.startsWith('addr'), 'Invalid address format');
   ```

4. **Store network with wallet**
   - Always save `network` in `docq_mint_wallets` table
   - Use the same network when loading wallet

## Recovery Steps

If minting fails with address error:

1. **Check the failed NFT record:**
   ```sql
   SELECT * FROM docq_mint_nfts WHERE status = 'failed';
   ```

2. **Check the error details:**
   ```sql
   SELECT metadata->>'error' FROM docq_mint_nfts WHERE status = 'failed';
   ```

3. **Verify wallet integrity:**
   ```sql
   SELECT address, network, created_at 
   FROM docq_mint_wallets 
   WHERE id = 'custody-wallet-id';
   ```

4. **Re-attempt minting:**
   - Delete failed NFT record:
     ```sql
     DELETE FROM docq_mint_nfts WHERE status = 'failed';
     ```
   - Try minting again from UI

## Environment Check

Ensure these variables are set correctly:

```bash
# Required for wallet encryption
SEED_ENCRYPT_KEY=your-32-character-key

# Required for blockchain access
BLOCKFROST_API_KEY=preprod_or_mainnet_key

# Ensure using correct network
# Preprod for testing, mainnet for production
```

## Additional Resources

- [MeshJS Wallet Documentation](https://meshjs.dev/apis/wallets)
- [Cardano Address Format](https://cips.cardano.org/cips/cip19/)
- [Blockfrost API](https://docs.blockfrost.io/)

---

**Last Updated:** 2026-01-12  
**Status:** ✅ Fixed with async/await corrections and validation

