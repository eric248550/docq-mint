import { NextRequest, NextResponse } from 'next/server';
import { generatePresignedUploadUrl, generateS3Key } from '@/lib/s3/presigned';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  EXTENSION_MIME_MAP,
  getFileExtension,
  MAX_FILE_UPLOAD_BYTES,
  MAX_FILE_UPLOAD_MB,
} from '@/lib/uploads/limits';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, fileSize, userId, folder } = body;
    let { contentType } = body;

    // Validate required fields
    if (!fileName) {
      return NextResponse.json(
        { error: 'fileName is required' },
        { status: 400 }
      );
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

    if (typeof fileSize !== 'number' || !Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json(
        { error: 'fileSize must be a positive number' },
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

    // Generate unique S3 key
    const key = generateS3Key(fileName, userId, folder);

    // Generate presigned URL
    const presignedData = await generatePresignedUploadUrl({
      key,
      contentType,
      expiresIn: 3600, // 1 hour
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
}

