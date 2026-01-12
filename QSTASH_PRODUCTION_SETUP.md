# QStash Production Setup Guide

## ✅ Code Changes Made

I've updated the code to support production QStash (non-local mode):

### 1. **Added Webhook Signature Verification** 
   - File: `/app/api/schools/[schoolId]/documents/mint/process/route.ts`
   - **Security**: Verifies QStash webhook signatures in production
   - **Auto-detection**: Skips verification in local mode (when `QSTASH_URL` contains 'localhost')

### 2. **Added Webhook URL Validation**
   - File: `/app/api/schools/[schoolId]/documents/mint/route.ts`
   - **Validation**: Ensures webhook URL is publicly accessible in production
   - **Error handling**: Returns clear error if localhost URL is used with production QStash

### 3. **Enhanced Logging**
   - Logs webhook URL being used
   - Logs signature verification status
   - Helps debug production issues

## 📋 Required Environment Variables

You mentioned you've already updated these - here's the checklist:

```bash
# Production QStash (from Upstash console)
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=your_production_token_here
QSTASH_CURRENT_SIGNING_KEY=your_current_key_here
QSTASH_NEXT_SIGNING_KEY=your_next_key_here

# Your publicly accessible app URL (REQUIRED for production)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Existing variables (no changes needed)
BLOCKFROST_API_KEY=your_blockfrost_key
SEED_ENCRYPT_KEY=your_32_char_key
```

## 🚨 Critical: NEXT_PUBLIC_APP_URL

**You MUST set `NEXT_PUBLIC_APP_URL` to your production domain.**

This URL is used by QStash to call your webhook. It must be:
- ✅ Publicly accessible (not localhost)
- ✅ HTTPS in production
- ✅ Include the full domain (e.g., `https://your-app.vercel.app`)

**Example:**
```bash
# ❌ Bad (will fail in production):
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ✅ Good:
NEXT_PUBLIC_APP_URL=https://docq-mint.vercel.app
```

## 🔒 Security Features

### Automatic Signature Verification

The code automatically:

1. **In Local Mode** (`QSTASH_URL` contains 'localhost'):
   ```
   🔓 Local mode: Skipping signature verification
   ```

2. **In Production Mode** (real QStash URL):
   ```
   ✅ QStash signature verified
   ```
   - Validates `upstash-signature` header
   - Uses `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`
   - Returns 401 if signature is invalid

### Webhook URL Protection

If you try to use production QStash with localhost:
```json
{
  "error": "Production QStash requires a publicly accessible webhook URL. Please set NEXT_PUBLIC_APP_URL environment variable."
}
```

## 🧪 Testing Production Setup

### 1. **Test Environment Variables**

Create a test endpoint to verify configuration:

```bash
curl https://your-domain.com/api/test-config
```

### 2. **Test Minting Flow**

1. Click "Publish All" or individual rocket icon
2. Check logs for:
   ```
   📤 Queuing minting job to: https://your-domain.com/api/schools/.../mint/process
   ```

3. Monitor QStash dashboard:
   - https://console.upstash.com/qstash

4. Check webhook is called:
   ```
   ✅ QStash signature verified
   🔐 Loading wallet: uuid-here
   ✅ Wallet loaded successfully
   ```

### 3. **Test Signature Verification**

The webhook will automatically reject requests without valid signatures:

```bash
# This should fail (missing signature)
curl -X POST https://your-domain.com/api/schools/xxx/documents/mint/process \
  -H "Content-Type: application/json" \
  -d '{"schoolId":"xxx"}'

# Response:
# {"error":"Missing upstash-signature header"}
```

## 🚀 Deployment Steps

### Step 1: Set Environment Variables

In your hosting platform (Vercel, AWS, etc.):

```bash
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=<from_upstash_console>
QSTASH_CURRENT_SIGNING_KEY=<from_upstash_console>
QSTASH_NEXT_SIGNING_KEY=<from_upstash_console>
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Step 2: Deploy Code

```bash
git add .
git commit -m "Add production QStash support"
git push
```

### Step 3: Verify Deployment

1. Check environment variables are loaded:
   ```bash
   # In production console
   echo $QSTASH_URL
   echo $NEXT_PUBLIC_APP_URL
   ```

2. Test minting:
   - Upload a document
   - Click "Publish"
   - Should see success message

3. Monitor QStash dashboard for job status

### Step 4: Monitor First Mints

Watch logs for:
- ✅ Signature verification
- ✅ Wallet loading
- ✅ Transaction submission
- ✅ On-chain confirmation

## 🔍 Troubleshooting

### Issue: "Production QStash requires a publicly accessible webhook URL"

**Cause:** `NEXT_PUBLIC_APP_URL` not set or contains localhost

**Fix:**
```bash
# Set in your hosting platform
NEXT_PUBLIC_APP_URL=https://your-actual-domain.com

# Rebuild and redeploy
```

### Issue: "Invalid webhook signature"

**Cause:** Incorrect signing keys or keys rotated

**Fix:**
1. Get latest keys from Upstash console
2. Update `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`
3. Redeploy

### Issue: "Missing upstash-signature header"

**Cause:** Webhook not called by QStash (direct access)

**Fix:**
- This is expected for direct access (security working!)
- Only QStash should call this endpoint
- If testing, use QStash dashboard to trigger manually

### Issue: Jobs queued but webhook not called

**Cause:** Webhook URL not publicly accessible

**Check:**
```bash
# Test if webhook is accessible
curl https://your-domain.com/api/schools/test/documents/mint/process

# Should return 401 (signature validation)
# If timeout/error, URL is not accessible
```

**Fix:**
- Ensure app is deployed and running
- Check firewall rules
- Verify domain DNS is correct

## 📊 Monitoring

### QStash Dashboard

Monitor your jobs at: https://console.upstash.com/qstash

**Metrics to watch:**
- Job success rate
- Average execution time
- Failed jobs
- Retry attempts

### Application Logs

Key log messages:

```
📤 Queuing minting job to: https://...
✅ QStash signature verified
🔐 Loading wallet: uuid
✅ Wallet loaded successfully
🚀 Starting minting process for N document(s)
📝 Transaction submitted: tx_hash
⏳ Waiting for on-chain confirmation...
✅ Transaction confirmed on-chain: tx_hash
✅ Successfully minted N document(s)
```

### Database Monitoring

Query for stuck jobs:

```sql
-- Pending mints older than 10 minutes
SELECT COUNT(*) as stuck_mints
FROM docq_mint_nfts
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '10 minutes';

-- Recent failures
SELECT d.original_filename, 
       n.metadata->>'error' as error,
       n.created_at
FROM docq_mint_nfts n
JOIN docq_mint_documents d ON n.document_id = d.id
WHERE n.status = 'failed'
  AND n.created_at > NOW() - INTERVAL '24 hours'
ORDER BY n.created_at DESC;
```

## 🔄 Switching Between Local and Production

The code automatically detects mode based on `QSTASH_URL`:

### Local Development:
```bash
QSTASH_URL=http://localhost:8080
QSTASH_TOKEN=eyJVc2VySUQiOiJkZWZhdWx0VXNlciIsIlBhc3N3b3JkIjoiZGVmYXVsdFBhc3N3b3JkIn0=
# No NEXT_PUBLIC_APP_URL needed (uses request.nextUrl.origin)
```

### Production:
```bash
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=<production_token>
QSTASH_CURRENT_SIGNING_KEY=<production_key>
QSTASH_NEXT_SIGNING_KEY=<production_key>
NEXT_PUBLIC_APP_URL=https://your-domain.com  # REQUIRED
```

## ✅ Pre-Deployment Checklist

- [ ] Updated `QSTASH_URL` to production URL
- [ ] Updated `QSTASH_TOKEN` with production token
- [ ] Set `QSTASH_CURRENT_SIGNING_KEY`
- [ ] Set `QSTASH_NEXT_SIGNING_KEY`
- [ ] **Set `NEXT_PUBLIC_APP_URL` to public domain** ⚠️ CRITICAL
- [ ] Verified all environment variables in hosting platform
- [ ] Deployed latest code
- [ ] Tested minting with single document
- [ ] Checked QStash dashboard for successful execution
- [ ] Verified NFT status updated to 'minted' in database

## 🎯 Summary

**What changed:**
1. ✅ Added automatic signature verification for production
2. ✅ Added webhook URL validation
3. ✅ Enhanced logging for debugging

**What you need to do:**
1. ✅ Set production QStash environment variables (you've done this)
2. ⚠️ **Set `NEXT_PUBLIC_APP_URL` to your production domain**
3. ✅ Deploy the updated code
4. ✅ Test minting functionality

**No other code changes needed!** The system automatically adapts based on your environment variables.

---

**Questions?** Check the logs or QStash dashboard for detailed execution information.

