import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { authenticatedRequest } from '@/lib/api/client';
import { DBDocumentType } from '@/lib/db/types';

/**
 * Fetches the admin-managed catalog of document types (active + inactive).
 * Consumers should filter to `is_active` for "choose a type" pickers, and
 * use the full list for labels/filters so historical documents still resolve.
 */
export function useDocumentTypes() {
  const { getAuthToken } = useAuthStore();
  const [documentTypes, setDocumentTypes] = useState<DBDocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocumentTypes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await authenticatedRequest<{ documentTypes: DBDocumentType[] }>(
        '/api/document-types',
        token
      );

      if (response.error) throw new Error(response.error);
      if (response.data) setDocumentTypes(response.data.documentTypes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch document types');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    fetchDocumentTypes();
  }, [fetchDocumentTypes]);

  const activeDocumentTypes = documentTypes.filter((t) => t.is_active);

  return {
    documentTypes,
    activeDocumentTypes,
    isLoading,
    error,
    refetch: fetchDocumentTypes,
  };
}
