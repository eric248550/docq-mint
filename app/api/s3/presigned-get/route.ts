import { NextRequest, NextResponse } from 'next/server';
import { getDownloadPresignedUrl } from '@/lib/s3/presigned';

/**
 * GET /api/s3/presigned-get?key=logos/...
 * Returns a short-lived presigned GET URL for a private S3 object.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }

  try {
    const url = await getDownloadPresignedUrl(key, 3600);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Failed to generate presigned GET URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate presigned URL' },
      { status: 500 }
    );
  }
}
