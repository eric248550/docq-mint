import { useState } from 'react';
import { uploadFileToS3, type S3UploadResult } from '@/lib/uploads/s3-client-upload';

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
  s3Key?: string;
  s3Url?: string;
}

export interface UploadResult {
  url: string;
  key: string;
}

export interface UseS3UploadReturn {
  uploadFile: (file: File, userId?: string, folder?: string) => Promise<UploadResult | null>;
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

  const uploadFile = async (
    file: File,
    userId?: string,
    folder?: string
  ): Promise<UploadResult | null> => {
    try {
      setProgress({
        fileName: file.name,
        progress: 0,
        status: 'uploading',
      });

      setProgress((prev) => ({ ...prev, progress: 30 }));

      const result: S3UploadResult = await uploadFileToS3(file, { userId, folder });

      setProgress({
        fileName: file.name,
        progress: 100,
        status: 'success',
        s3Key: result.key,
        s3Url: result.url,
      });

      return result;
    } catch (error) {
      console.error('Upload error:', error);
      setProgress({
        fileName: file.name,
        progress: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed',
      });
      return null;
    }
  };

  return {
    uploadFile,
    progress,
    reset,
  };
}
