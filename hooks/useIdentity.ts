import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { authenticatedRequest } from '@/lib/api/client';

/**
 * Hook for managing user identity context
 */
export function useIdentity() {
  const { identityContext, selectedSchoolId, setIdentityContext, getAuthToken } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectIdentity = async (
    context: 'student' | 'school_admin',
    schoolId?: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await authenticatedRequest(
        '/api/users/identity',
        token,
        {
          method: 'POST',
          body: JSON.stringify({ context, schoolId }),
        }
      );

      if (response.error) {
        throw new Error(response.error);
      }

      setIdentityContext(context, schoolId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set identity';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    identityContext,
    selectedSchoolId,
    selectIdentity,
    isLoading,
    error,
  };
}

