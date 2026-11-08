import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { getDownloadPresignedUrl } from '@/lib/s3/presigned';

/**
 * GET /api/s3/presigned-get?key=logos/...
 * Returns a short-lived presigned GET URL for an organization logo.
 * Documents have their own access-checked download routes.
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    const key = request.nextUrl.searchParams.get('key');

    if (!key || !key.startsWith('logos/') || key.includes('..')) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }

    try {
      const url = await getDownloadPresignedUrl(key, 300);
      return NextResponse.json({ url });
    } catch (error) {
      console.error('Failed to generate presigned GET URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate presigned URL' },
        { status: 500 }
      );
    }
  });
}
