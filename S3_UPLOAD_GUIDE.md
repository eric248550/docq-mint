# S3 File Upload with Presigned URLs

This project implements secure S3 file uploads using presigned URLs. The architecture ensures AWS credentials stay on the backend while files are uploaded directly from the browser to S3.

## Architecture

```
Frontend (Browser)
    ↓ 1. Request presigned URL
Backend API (/api/s3/presigned-url)
    ↓ 2. Generate presigned URL using AWS credentials
    ↓ 3. Return presigned URL to frontend
Frontend
    ↓ 4. Upload file directly to S3 using presigned URL
AWS S3 Bucket
```

## Files Structure

```
lib/s3/
├── config.ts          # S3 client configuration (server-side only)
└── presigned.ts       # Presigned URL generation utilities

app/api/s3/
└── presigned-url/
    └── route.ts       # API endpoint to generate presigned URLs

hooks/
└── useS3Upload.ts     # React hook for handling uploads

components/
└── S3FileUpload.tsx   # UI component for file uploads

app/upload/
└── page.tsx           # Upload page
```

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the project root (this file is git-ignored):

```bash
# AWS S3 Configuration (Server-side only - DO NOT prefix with NEXT_PUBLIC_)
AWS_ACCESS_KEY_ID=AKIAWKMDD6RLLUTRZ4VZ
AWS_SECRET_ACCESS_KEY=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
AWS_REGION=us-east-1
AWS_BUCKET_NAME=docq-mint
```

**Important:** These variables do NOT have `NEXT_PUBLIC_` prefix because they should only be accessible server-side.

### 2. AWS IAM Permissions

Your IAM user needs the following permissions on the S3 bucket:

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
    }
  ]
}
```

### 3. S3 Bucket CORS Configuration

Add CORS configuration to your S3 bucket to allow browser uploads:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### 4. Install Dependencies

Dependencies are already installed:
- `@aws-sdk/client-s3` - AWS SDK for S3
- `@aws-sdk/s3-request-presigner` - For generating presigned URLs

### 5. Run the Application

```bash
npm run dev
```

Navigate to `http://localhost:3000/upload` to test the file upload.

## Usage

### Using the Upload Component

```tsx
import S3FileUpload from '@/components/S3FileUpload';

export default function YourPage() {
  return <S3FileUpload />;
}
```

### Using the Upload Hook Directly

```tsx
import { useS3Upload } from '@/hooks/useS3Upload';

function CustomUploadComponent() {
  const { uploadFile, progress, reset } = useS3Upload();

  const handleUpload = async (file: File) => {
    await uploadFile(file, 'user-123', 'documents');
  };

  return (
    <div>
      {progress.status === 'success' && (
        <p>File uploaded to: {progress.s3Url}</p>
      )}
    </div>
  );
}
```

### API Endpoint Usage

You can also call the API endpoint directly:

```typescript
// Request presigned URL
const response = await fetch('/api/s3/presigned-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: 'example.pdf',
    contentType: 'application/pdf',
    userId: 'user-123',
    folder: 'documents',
  }),
});

const { url, key, bucket } = await response.json();

// Upload file to S3
await fetch(url, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type },
});
```

## Security Features

1. **Credentials Protection**: AWS credentials never leave the backend
2. **Time-Limited URLs**: Presigned URLs expire after 1 hour by default
3. **Content Type Validation**: Backend validates allowed file types
4. **Direct Upload**: Files never pass through your backend server
5. **Unique Keys**: Each upload gets a unique S3 key with timestamp and random string

## Allowed File Types

Currently configured to allow:
- Images: JPEG, PNG, GIF, WebP
- Documents: PDF, TXT, JSON, CSV, DOC, DOCX

To modify allowed types, edit `app/api/s3/presigned-url/route.ts`:

```typescript
const allowedTypes = [
  'image/jpeg',
  'image/png',
  // Add more types here
];
```

## Troubleshooting

### "AccessDenied" Error

If you get an AccessDenied error:
1. Check that your IAM user has `s3:PutObject` permission
2. Verify the IAM policy allows access to `arn:aws:s3:::docq-mint/*`
3. Check that the bucket name in `.env.local` matches your actual bucket

### CORS Errors

If uploads fail with CORS errors:
1. Add your domain to the S3 bucket's CORS configuration
2. Make sure `PUT` method is allowed in CORS
3. For local development, ensure `http://localhost:3000` is in AllowedOrigins

### "Failed to get presigned URL"

1. Check that environment variables are set correctly
2. Verify AWS credentials are valid
3. Check the API route is accessible at `/api/s3/presigned-url`

## Vercel Deployment with OIDC (Recommended)

For production deployment on Vercel, use OIDC instead of long-lived credentials:

1. Create an IAM role in AWS with a trust policy for Vercel
2. Add the role ARN to Vercel environment variables
3. Vercel will automatically assume the role for AWS operations

See Vercel's AWS integration documentation for detailed setup.

## Next Steps

- [ ] Add file size limits
- [ ] Implement file type icons in UI
- [ ] Add drag-and-drop support
- [ ] Store upload metadata in database
- [ ] Add file deletion functionality
- [ ] Implement multi-file upload
- [ ] Add progress tracking with XMLHttpRequest for more detailed progress

