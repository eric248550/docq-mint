import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, bucketName } from './config';

export interface PresignedUrlOptions {
  key: string;
  contentType: string;
  expiresIn?: number; // seconds, default 3600 (1 hour)
  metadata?: Record<string, string>;
}

export interface PresignedUrlResponse {
  url: string;
  key: string;
  bucket: string;
  expiresIn: number;
  headers?: Record<string, string>;
}

/**
 * Generate a presigned URL for uploading a file to S3
 * This should only be called server-side
 */
export async function generatePresignedUploadUrl(
  options: PresignedUrlOptions
): Promise<PresignedUrlResponse> {
  const { key, contentType, expiresIn = 3600, metadata } = options;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  // Generate presigned URL without checksum parameters
  const url = await getSignedUrl(s3Client, command, { 
    expiresIn,
  });

  // Return headers that must be included in the upload request
  const headers: Record<string, string> = {
    'Content-Type': contentType,
  };

  return {
    url,
    key,
    bucket: bucketName,
    expiresIn,
    headers,
  };
}

/**
 * Generate a unique S3 key for a file
 */
export function generateS3Key(
  fileName: string,
  userId?: string,
  folder: string = 'uploads'
): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  if (userId) {
    return `${folder}/${userId}/${timestamp}-${randomStr}-${sanitizedFileName}`;
  }
  
  return `${folder}/${timestamp}-${randomStr}-${sanitizedFileName}`;
}

