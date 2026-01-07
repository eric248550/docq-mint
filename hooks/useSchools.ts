import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { authenticatedRequest } from '@/lib/api/client';
import { DBSchool, DBSchoolMembership, DBDocument } from '@/lib/db/types';

export function useSchools() {
  const { getAuthToken } = useAuthStore();
  const [schools, setSchools] = useState<DBSchool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchools = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await authenticatedRequest<{ schools: DBSchool[] }>(
        '/api/schools',
        token
      );

      if (response.error) throw new Error(response.error);
      if (response.data) setSchools(response.data.schools);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch schools');
    } finally {
      setIsLoading(false);
    }
  };

  const createSchool = async (data: {
    name: string;
    country_code?: string;
    compliance_region?: string;
  }) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await authenticatedRequest<{ school: DBSchool }>(
      '/api/schools',
      token,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    if (response.error) throw new Error(response.error);
    if (response.data) {
      setSchools([...schools, response.data.school]);
      return response.data.school;
    }
  };

  const updateSchool = async (schoolId: string, data: Partial<DBSchool>) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await authenticatedRequest<{ school: DBSchool }>(
      `/api/schools/${schoolId}`,
      token,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );

    if (response.error) throw new Error(response.error);
    if (response.data) {
      setSchools(schools.map(s => s.id === schoolId ? response.data!.school : s));
      return response.data.school;
    }
  };

  const deleteSchool = async (schoolId: string) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await authenticatedRequest(
      `/api/schools/${schoolId}`,
      token,
      { method: 'DELETE' }
    );

    if (response.error) throw new Error(response.error);
    setSchools(schools.filter(s => s.id !== schoolId));
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  return {
    schools,
    isLoading,
    error,
    refetch: fetchSchools,
    createSchool,
    updateSchool,
    deleteSchool,
  };
}

export function useSchoolMembers(schoolId: string | null) {
  const { getAuthToken } = useAuthStore();
  const [members, setMembers] = useState<(DBSchoolMembership & { email: string | null })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = async () => {
    if (!schoolId) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await authenticatedRequest<{ members: (DBSchoolMembership & { email: string | null })[] }>(
        `/api/schools/${schoolId}/members`,
        token
      );

      if (response.error) throw new Error(response.error);
      if (response.data) setMembers(response.data.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch members');
    } finally {
      setIsLoading(false);
    }
  };

  const inviteMember = async (data: { email?: string; role: string }) => {
    if (!schoolId) throw new Error('No school selected');

    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await authenticatedRequest<{ membership: DBSchoolMembership }>(
      `/api/schools/${schoolId}/members`,
      token,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    if (response.error) throw new Error(response.error);
    await fetchMembers();
    return response.data?.membership;
  };

  const removeMember = async (memberId: string) => {
    if (!schoolId) throw new Error('No school selected');

    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await authenticatedRequest(
      `/api/schools/${schoolId}/members/${memberId}`,
      token,
      { method: 'DELETE' }
    );

    if (response.error) throw new Error(response.error);
    setMembers(members.filter(m => m.id !== memberId));
  };

  useEffect(() => {
    fetchMembers();
  }, [schoolId]);

  return {
    members,
    isLoading,
    error,
    refetch: fetchMembers,
    inviteMember,
    removeMember,
  };
}

export function useSchoolDocuments(schoolId: string | null) {
  const { getAuthToken } = useAuthStore();
  const [documents, setDocuments] = useState<DBDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async (studentId?: string) => {
    if (!schoolId) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const url = studentId
        ? `/api/schools/${schoolId}/documents?student_id=${studentId}`
        : `/api/schools/${schoolId}/documents`;

      const response = await authenticatedRequest<{ documents: DBDocument[] }>(url, token);

      if (response.error) throw new Error(response.error);
      if (response.data) setDocuments(response.data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setIsLoading(false);
    }
  };

  const createDocument = async (data: {
    student_id?: string;
    document_type: string;
    file_storage_provider: string;
    file_storage_url: string;
    file_hash: string;
    file_mime_type?: string;
    file_size_bytes?: number;
  }) => {
    if (!schoolId) throw new Error('No school selected');

    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await authenticatedRequest<{ document: DBDocument }>(
      `/api/schools/${schoolId}/documents`,
      token,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    if (response.error) throw new Error(response.error);
    if (response.data) {
      setDocuments([response.data.document, ...documents]);
      return response.data.document;
    }
  };

  const deleteDocument = async (documentId: string) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await authenticatedRequest(
      `/api/documents/${documentId}`,
      token,
      { method: 'DELETE' }
    );

    if (response.error) throw new Error(response.error);
    setDocuments(documents.filter(d => d.id !== documentId));
  };

  useEffect(() => {
    fetchDocuments();
  }, [schoolId]);

  return {
    documents,
    isLoading,
    error,
    refetch: fetchDocuments,
    createDocument,
    deleteDocument,
  };
}

export function useStudentDocuments() {
  const { getAuthToken } = useAuthStore();
  const [documents, setDocuments] = useState<DBDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await authenticatedRequest<{ documents: DBDocument[] }>(
        '/api/students/documents',
        token
      );

      if (response.error) throw new Error(response.error);
      if (response.data) setDocuments(response.data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  return {
    documents,
    isLoading,
    error,
    refetch: fetchDocuments,
  };
}

