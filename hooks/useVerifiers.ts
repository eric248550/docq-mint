import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { authenticatedRequest } from '@/lib/api/client';
import { DBVerifier, DBVerifierMembership } from '@/lib/db/types';
import { Pagination, MemberFilters } from './useSchools';

function buildParams(filters: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== '') p.set(key, String(val));
  }
  return p.toString();
}

export function useVerifiers() {
  const { getAuthToken } = useAuthStore();
  const [verifiers, setVerifiers] = useState<DBVerifier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVerifiers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const response = await authenticatedRequest<{ verifiers: DBVerifier[] }>(
        '/api/verifiers',
        token
      );
      if (response.error) throw new Error(response.error);
      if (response.data) setVerifiers(response.data.verifiers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch verifiers');
    } finally {
      setIsLoading(false);
    }
  };

  const createVerifier = async (data: { name: string }) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');
    const response = await authenticatedRequest<{ verifier: DBVerifier }>(
      '/api/verifiers',
      token,
      { method: 'POST', body: JSON.stringify(data) }
    );
    if (response.error) throw new Error(response.error);
    if (response.data) {
      setVerifiers([...verifiers, response.data.verifier]);
      return response.data.verifier;
    }
  };

  const updateVerifier = async (verifierId: string, data: Partial<DBVerifier>) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');
    const response = await authenticatedRequest<{ verifier: DBVerifier }>(
      `/api/verifiers/${verifierId}`,
      token,
      { method: 'PATCH', body: JSON.stringify(data) }
    );
    if (response.error) throw new Error(response.error);
    if (response.data) {
      setVerifiers(verifiers.map(v => v.id === verifierId ? response.data!.verifier : v));
      return response.data.verifier;
    }
  };

  const deleteVerifier = async (verifierId: string) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');
    const response = await authenticatedRequest(
      `/api/verifiers/${verifierId}`,
      token,
      { method: 'DELETE' }
    );
    if (response.error) throw new Error(response.error);
    setVerifiers(verifiers.filter(v => v.id !== verifierId));
  };

  useEffect(() => {
    fetchVerifiers();
  }, []);

  return {
    verifiers,
    isLoading,
    error,
    refetch: fetchVerifiers,
    createVerifier,
    updateVerifier,
    deleteVerifier,
  };
}

export function useVerifierMembers(verifierId: string | null) {
  const { getAuthToken } = useAuthStore();
  const [members, setMembers] = useState<(DBVerifierMembership & { email: string | null })[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = async (filters: MemberFilters = {}) => {
    if (!verifierId) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const qs = buildParams(filters as Record<string, string | number | undefined>);
      const url = `/api/verifiers/${verifierId}/members${qs ? `?${qs}` : ''}`;
      const response = await authenticatedRequest<{
        data: (DBVerifierMembership & { email: string | null })[];
        pagination: Pagination;
      }>(url, token);
      if (response.error) throw new Error(response.error);
      if (response.data) {
        setMembers(response.data.data);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch members');
    } finally {
      setIsLoading(false);
    }
  };

  const inviteMember = async (data: { email?: string; role: string }) => {
    if (!verifierId) throw new Error('No verifier selected');
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');
    const response = await authenticatedRequest<{ membership: DBVerifierMembership }>(
      `/api/verifiers/${verifierId}/members`,
      token,
      { method: 'POST', body: JSON.stringify(data) }
    );
    if (response.error) throw new Error(response.error);
    await fetchMembers();
    return response.data?.membership;
  };

  const removeMember = async (memberId: string) => {
    if (!verifierId) throw new Error('No verifier selected');
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');
    const response = await authenticatedRequest(
      `/api/verifiers/${verifierId}/members/${memberId}`,
      token,
      { method: 'DELETE' }
    );
    if (response.error) throw new Error(response.error);
    setMembers(members.filter(m => m.id !== memberId));
  };

  return {
    members,
    pagination,
    isLoading,
    error,
    refetch: fetchMembers,
    inviteMember,
    removeMember,
  };
}
