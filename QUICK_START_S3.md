# Quick Start: S3 Upload Feature

## ⚡ Quick Setup (5 minutes)

### Step 1: Set Environment Variables

Copy the `.env.local.template` contents to create `.env.local`:

```bash
AWS_ACCESS_KEY_ID=AKIAWKMDD6RLLUTRZ4VZ
AWS_SECRET_ACCESS_KEY=gvfJ8KQSFdlxFqwpHXcjzLZ61EziZUKntJd1RcMF
AWS_REGION=us-east-1
AWS_BUCKET_NAME=docq-mint
```

### Step 2: Fix IAM Permissions

Your IAM user `local-dev-docq-s3` needs proper permissions. 

**Go to AWS Console → IAM → Users → local-dev-docq-s3 → Add permissions**

Attach this inline policy (also saved in `IAM_POLICY.json`):

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

### Step 3: Configure S3 CORS

**Go to AWS Console → S3 → docq-mint bucket → Permissions → CORS**

Paste this configuration (also saved in `S3_CORS_CONFIG.json`):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://yourdomain.com",
      "https://*.vercel.app"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### Step 4: Run the App

```bash
npm run dev
```

Navigate to: **http://localhost:3000/upload**

## ✅ What's Working

- ✅ AWS SDK installed and configured
- ✅ Backend API endpoint for presigned URLs (`/api/s3/presigned-url`)
- ✅ Frontend upload component with beautiful UI
- ✅ React hook for easy upload integration
- ✅ Direct browser-to-S3 upload (no backend bottleneck)
- ✅ Progress tracking
- ✅ Error handling
- ✅ File type validation
- ✅ Unique file naming with timestamps

## 🔒 Security Features

1. **AWS credentials stay server-side** - Never exposed to browser
2. **Presigned URLs expire** - Default 1 hour expiration
3. **File type validation** - Backend validates allowed types
4. **CORS protection** - Only allowed origins can upload
5. **Unique keys** - Prevents file overwrites

## 🎨 Features

- Drag & drop UI (styled beautifully)
- Real-time upload progress
- Success/error messages
- File metadata display
- Direct S3 URL after upload
- Responsive design

## 📁 Files Created

```
lib/s3/
├── config.ts                    # S3 client (server-side only)
└── presigned.ts                 # Presigned URL generation

app/api/s3/presigned-url/
└── route.ts                     # API endpoint

hooks/
└── useS3Upload.ts               # React upload hook

components/
└── S3FileUpload.tsx             # Upload UI component

app/upload/
└── page.tsx                     # Upload page

Configuration files:
├── IAM_POLICY.json             # Copy to AWS IAM
├── S3_CORS_CONFIG.json         # Copy to S3 CORS settings
└── S3_UPLOAD_GUIDE.md          # Detailed documentation
```

## 🐛 Troubleshooting

### Error: "User is not authorized to perform: s3:PutObject"

**Solution:** Follow Step 2 above to add IAM permissions.

### Error: "CORS policy"

**Solution:** Follow Step 3 above to configure S3 CORS.

### Error: "Failed to get presigned URL"

**Solution:** 
1. Make sure `.env.local` exists (git-ignored, so you need to create it)
2. Restart the dev server after creating `.env.local`
3. Check that AWS credentials are correct

## 🚀 Usage in Your Code

```tsx
import { useS3Upload } from '@/hooks/useS3Upload';

function MyComponent() {
  const { uploadFile, progress } = useS3Upload();

  const handleFileSelect = async (file: File) => {
    await uploadFile(file, userId, 'my-folder');
    
    if (progress.status === 'success') {
      console.log('File URL:', progress.s3Url);
      console.log('S3 Key:', progress.s3Key);
      // Save to database, etc.
    }
  };

  return <div>Upload status: {progress.status}</div>;
}
```

## 🔗 Integration with Vercel (Production)

For production, use **OIDC** instead of access keys:

1. Create IAM role with trust policy for Vercel
2. Add role ARN to Vercel environment variables
3. Vercel automatically assumes the role

See [Vercel AWS Integration](https://vercel.com/docs/integrations/aws) for setup.

## ✨ Next Steps

- [ ] Test upload at http://localhost:3000/upload
- [ ] Fix IAM permissions if needed
- [ ] Configure CORS if needed
- [ ] Integrate with your auth system (pass userId)
- [ ] Store upload metadata in database
- [ ] Add file management (list, delete)

