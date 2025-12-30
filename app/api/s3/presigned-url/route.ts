import { NextRequest, NextResponse } from 'next/server';
import { generatePresignedUploadUrl, generateS3Key } from '@/lib/s3/presigned';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, contentType, userId, folder } = body;

    // Validate required fields
    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: 'fileName and contentType are required' },
        { status: 400 }
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

