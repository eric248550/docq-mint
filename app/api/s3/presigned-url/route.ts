import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { generatePresignedUploadUrl, generateS3Key } from '@/lib/s3/presigned';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  EXTENSION_MIME_MAP,
  getFileExtension,
  MAX_FILE_UPLOAD_BYTES,
  MAX_FILE_UPLOAD_MB,
} from '@/lib/uploads/limits';

const ALLOWED_UPLOAD_FOLDERS = ['uploads', 'logos'];

export async function POST(request: NextRequest) {
  return withAuth(request, async ({ dbUser }) => {
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    try {
      const body = await request.json();
      const { fileName, fileSize, folder = 'uploads' } = body;
      let { contentType } = body;

      // Validate required fields
      if (!fileName) {
        return NextResponse.json(
          { error: 'fileName is required' },
          { status: 400 }
        );
      }

      if (!ALLOWED_UPLOAD_FOLDERS.includes(folder)) {
        return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
      }

      if (!contentType || !(ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(contentType)) {
        const mapped = EXTENSION_MIME_MAP[getFileExtension(fileName)];
        if (mapped) contentType = mapped;
      }

      if (!contentType) {
        return NextResponse.json(
          { error: 'fileName and contentType are required' },
          { status: 400 }
        );
      }

      if (typeof fileSize !== 'number' || !Number.isInteger(fileSize) || fileSize <= 0) {
        return NextResponse.json(
          { error: 'fileSize must be a positive integer' },
          { status: 400 }
        );
      }

      if (fileSize > MAX_FILE_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `File is too large. Max size is ${MAX_FILE_UPLOAD_MB}MB per file.` },
          { status: 413 }
        );
      }

      if (!(ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(contentType)) {
        return NextResponse.json(
          { error: `Content type ${contentType} is not allowed` },
          { status: 400 }
        );
      }

      // The uploader always comes from the session, never from the request.
      const key = generateS3Key(fileName, dbUser.id, folder);

      const presignedData = await generatePresignedUploadUrl({
        key,
        contentType,
        contentLength: fileSize,
        expiresIn: 300,
      });

      return NextResponse.json({
        success: true,
        ...presignedData,
      });
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate presigned URL' },
        { status: 500 }
      );
    }
  });
}
