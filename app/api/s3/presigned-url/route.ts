import { NextRequest, NextResponse } from 'next/server';
import { generatePresignedUploadUrl, generateS3Key } from '@/lib/s3/presigned';
import { MAX_FILE_UPLOAD_BYTES, MAX_FILE_UPLOAD_MB } from '@/lib/uploads/limits';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, contentType, fileSize, userId, folder } = body;

    // Validate required fields
    if (!fileName || !contentType) {
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

    // Validate content type (optional - add your own restrictions)
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/json',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(contentType)) {
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

