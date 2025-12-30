import { useState } from 'react';

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
  s3Key?: string;
  s3Url?: string;
}

export interface UseS3UploadReturn {
  uploadFile: (file: File, userId?: string, folder?: string) => Promise<void>;
  progress: UploadProgress;
  reset: () => void;
}

export function useS3Upload(): UseS3UploadReturn {
  const [progress, setProgress] = useState<UploadProgress>({
    fileName: '',
    progress: 0,
    status: 'idle',
  });

  const reset = () => {
    setProgress({
      fileName: '',
      progress: 0,
      status: 'idle',
    });
  };

  const uploadFile = async (file: File, userId?: string, folder?: string) => {
    try {
      setProgress({
        fileName: file.name,
        progress: 0,
        status: 'uploading',
      });

      // Step 1: Get presigned URL from backend
      const presignedResponse = await fetch('/api/s3/presigned-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          userId,
          folder,
        }),
      });

      if (!presignedResponse.ok) {
        const error = await presignedResponse.json();
        throw new Error(error.error || 'Failed to get presigned URL');
      }

      const { url, key, bucket, headers } = await presignedResponse.json();

      setProgress(prev => ({ ...prev, progress: 30 }));

      // Step 2: Upload file directly to S3 using presigned URL
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: headers || {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        // Get detailed error from S3
        const errorText = await uploadResponse.text();
        console.error('S3 Upload Error:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          body: errorText,
        });
        throw new Error(`Failed to upload file to S3: ${uploadResponse.status} ${errorText}`);
      }

      setProgress(prev => ({ ...prev, progress: 100 }));

      // Step 3: Success
      const s3Url = `https://${bucket}.s3.amazonaws.com/${key}`;
      
      setProgress({
        fileName: file.name,
        progress: 100,
        status: 'success',
        s3Key: key,
        s3Url,
      });
    } catch (error) {
      console.error('Upload error:', error);
      setProgress({
        fileName: file.name,
        progress: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  };

  return {
    uploadFile,
    progress,
    reset,
  };
}

