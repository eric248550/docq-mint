# AWS S3 Upload - Setup Checklist ✓

Follow these steps in order to get S3 uploads working.

## ☑️ Step 1: Create `.env.local` File

Create a file called `.env.local` in the project root with these contents:

```bash
AWS_ACCESS_KEY_ID=AKIAWKMDD6RLLUTRZ4VZ
AWS_SECRET_ACCESS_KEY=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
AWS_REGION=us-east-1
AWS_BUCKET_NAME=docq-mint
```

**Important:** This file is git-ignored and won't be committed.

---

## ☑️ Step 2: Fix IAM Permissions

Your IAM user needs permissions to upload to S3.

### Go to AWS Console:
1. Navigate to **IAM → Users**
2. Click on **local-dev-docq-s3**
3. Click **Add permissions → Attach policies directly**
4. Click **Create inline policy**
5. Switch to **JSON** tab
6. Paste the contents from `IAM_POLICY.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::docq-mint/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::docq-mint"
    }
  ]
}
```

7. Click **Review policy**
8. Name it: `docq-mint-s3-upload-policy`
9. Click **Create policy**

**✅ Verification:** Try uploading a file after this step.

---

## ☑️ Step 3: Configure S3 CORS

S3 needs CORS configuration to allow browser uploads.

### Go to AWS Console:
1. Navigate to **S3 → Buckets**
2. Click on **docq-mint**
3. Go to **Permissions** tab
4. Scroll down to **Cross-origin resource sharing (CORS)**
5. Click **Edit**
6. Paste the contents from `S3_CORS_CONFIG.json`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://yourdomain.com",
      "https://*.vercel.app"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

7. Click **Save changes**

**✅ Verification:** CORS errors should disappear.

---

## ☑️ Step 4: Restart Dev Server

After creating `.env.local`:

```bash
# Stop the dev server (Ctrl+C if running)
npm run dev
```

Navigate to: **http://localhost:3001/upload**

---

## ☑️ Step 5: Test Upload

1. Go to http://localhost:3001/upload
2. Click to select a file or drag & drop
3. Click "Upload to S3"
4. You should see:
   - ✅ Progress bar
   - ✅ Success message
   - ✅ S3 URL of uploaded file

---

## 🎯 Expected Result

After completing all steps, you should see:

```
✅ Upload successful!
S3 Key: uploads/1234567890-abc123-yourfile.pdf
URL: https://docq-mint.s3.amazonaws.com/uploads/1234567890-abc123-yourfile.pdf
```

---

## 🐛 Troubleshooting

### "User is not authorized to perform: s3:PutObject"
→ **Go back to Step 2** - IAM permissions not set correctly

### "CORS policy: No 'Access-Control-Allow-Origin' header"
→ **Go back to Step 3** - CORS not configured

### "Failed to get presigned URL"
→ Check that `.env.local` exists and restart dev server

### "Cannot find module '@aws-sdk/client-s3'"
→ Run: `npm install`

---

## 📦 Files Reference

All configuration files are ready in your project:

- ✅ `IAM_POLICY.json` - Copy to AWS IAM
- ✅ `S3_CORS_CONFIG.json` - Copy to S3 CORS
- ✅ `.env.local` - Create with your credentials
- ✅ Code is ready - No changes needed

---

## 🚀 Production (Vercel)

For production deployment:

1. Add environment variables to Vercel project settings
2. Update CORS to include your production domain
3. Consider using OIDC instead of access keys (more secure)

See `S3_UPLOAD_GUIDE.md` for Vercel OIDC setup.

---

## ✨ You're Done!

Once all steps are complete, you have a production-ready S3 upload system with:
- 🔒 Secure presigned URLs
- 📊 Progress tracking
- 🎨 Beautiful UI
- ⚡ Direct browser-to-S3 upload
- 🛡️ No credentials exposed to frontend

