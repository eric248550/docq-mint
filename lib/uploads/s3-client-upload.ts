import {
  MAX_FILE_UPLOAD_BYTES,
  MAX_FILE_UPLOAD_MB,
  resolveContentType,
} from '@/lib/uploads/limits';

export interface S3UploadResult {
  url: string;
  key: string;
}

/**
 * Upload a single file to S3 via presigned URL (no React state).
 * Safe to call concurrently from a batch worker.
 */
export async function uploadFileToS3(
  file: File,
  options?: { userId?: string; folder?: string }
): Promise<S3UploadResult> {
  if (file.size > MAX_FILE_UPLOAD_BYTES) {
    throw new Error(`File is too large. Max size is ${MAX_FILE_UPLOAD_MB}MB per file.`);
  }

  const contentType = resolveContentType(file);

  const presignedResponse = await fetch('/api/s3/presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType,
      fileSize: file.size,
      userId: options?.userId,
      folder: options?.folder,
    }),
  });

  if (!presignedResponse.ok) {
    const error = await presignedResponse.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to get presigned URL');
  }

  const { url, key, bucket, headers } = await presignedResponse.json();

  const uploadResponse = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: headers || { 'Content-Type': contentType },
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('S3 Upload Error:', {
      status: uploadResponse.status,
      statusText: uploadResponse.statusText,
      body: errorText,
    });
    throw new Error(`Failed to upload file to S3: ${uploadResponse.status} ${errorText}`);
  }

  return {
    url: `https://${bucket}.s3.amazonaws.com/${key}`,
    key,
  };
}
