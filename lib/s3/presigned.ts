export const runtime = "nodejs";

import { randomUUID } from 'crypto';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, bucketName } from './config';

export interface PresignedUrlOptions {
  key: string;
  contentType: string;
  contentLength: number; // signed into the URL, so S3 rejects any other size
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
  const { key, contentType, contentLength, expiresIn = 3600 } = options;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
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
 * Generate a presigned URL for downloading a file from S3
 * This should only be called server-side
 */
export async function getDownloadPresignedUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return url;
}

/**
 * Generate a unique S3 key for a file
 */
export function generateS3Key(
  fileName: string,
  userId: string,
  folder: string = 'uploads'
): string {
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${folder}/${userId}/${Date.now()}-${randomUUID()}-${sanitizedFileName}`;
}

