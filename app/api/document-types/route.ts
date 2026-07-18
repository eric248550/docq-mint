import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { getAllDocumentTypes } from '@/lib/uploads/documentTypes';

/**
 * GET /api/document-types
 * Any authenticated user: list all document types (active + inactive).
 * Inactive types are included so existing documents can still resolve a
 * label; upload/creation UIs should filter to `is_active` themselves.
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    const documentTypes = await getAllDocumentTypes();
    return NextResponse.json({ documentTypes });
  });
}
