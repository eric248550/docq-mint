import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';

// S3 Configuration - Server-side only
export const s3Config: S3ClientConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  // Disable automatic checksum calculation for presigned URLs
  requestChecksumCalculation: 'WHEN_REQUIRED',
};

export const bucketName = process.env.AWS_BUCKET_NAME || 'docq-mint';

// Create S3 Client - Server-side only
export const s3Client = new S3Client(s3Config);

