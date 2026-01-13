'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useIdentity } from '@/hooks/useIdentity';
import { authenticatedRequest } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { DBSchool, DBSchoolMembership } from '@/lib/db/types';
import { GraduationCap, Building2, Loader2 } from 'lucide-react';

interface UserMembershipsData {
  user: any;
  memberships: (DBSchoolMembership & { school_name: string })[];
}

export function IdentitySelector() {
  const router = useRouter();
  const { user, getAuthToken } = useAuthStore();
  const { selectIdentity } = useIdentity();
  const [memberships, setMemberships] = useState<(DBSchoolMembership & { school_name: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContext, setSelectedContext] = useState<'student' | 'school_admin' | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMemberships = async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;

        const response = await authenticatedRequest<UserMembershipsData>(
          '/api/users/me',
          token
        );

        if (response.data) {
          setMemberships(response.data.memberships);
        }
      } catch (error) {
        console.error('Failed to fetch memberships:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchMemberships();
    }
  }, [user]);

  const handleSelectIdentity = async () => {
    if (!selectedContext || !selectedSchoolId) return;

    try {
      await selectIdentity(selectedContext, selectedSchoolId);
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to select identity:', error);
    }
  };

  const hasAdminRole = memberships.some(m => ['owner', 'admin'].includes(m.role));
  const hasStudentRole = memberships.some(m => m.role === 'student');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (memberships.length === 0) {
    return (
      <div className="text-center p-8 max-w-md mx-auto">
        <div className="mb-6">
          <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Welcome to DOCQ-Mint</h2>
          <p className="text-muted-foreground">
            You don&apos;t have any organizations yet.
          </p>
        </div>
        <div className="space-y-3">
          <Button onClick={() => router.push('/schools/create')} className="w-full">
            <Building2 className="mr-2 h-4 w-4" />
            Create a Organization
          </Button>
          <p className="text-sm text-muted-foreground">
          Or wait for an administrator to invite you as a member or user.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-2">Select Your Role</h2>
      <p className="text-muted-foreground mb-8">
        Choose how you want to access DOCQ Mint
      </p>

      <div className="space-y-4">
        {/* School Admin Option */}
        {hasAdminRole && (
          <div
            onClick={() => setSelectedContext('school_admin')}
            className={`border rounded-lg p-6 cursor-pointer transition-all ${
              selectedContext === 'school_admin'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">School Administrator</h3>
                <p className="text-muted-foreground mb-4">
                  Manage schools, upload documents, and invite students
                </p>
                
                {selectedContext === 'school_admin' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select School:</label>
                    <select
                      value={selectedSchoolId || ''}
                      onChange={(e) => setSelectedSchoolId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="">Select a school...</option>
                      {memberships
                        .filter(m => ['owner', 'admin'].includes(m.role))
                        .map(m => (
                          <option key={m.id} value={m.school_id}>
                            {m.school_name}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Student Option */}
        {hasStudentRole && (
          <div
            onClick={() => setSelectedContext('student')}
            className={`border rounded-lg p-6 cursor-pointer transition-all ${
              selectedContext === 'student'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">Student</h3>
                <p className="text-muted-foreground mb-4">
                  View your documents and records
                </p>
                
                {selectedContext === 'student' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select School:</label>
                    <select
                      value={selectedSchoolId || ''}
                      onChange={(e) => setSelectedSchoolId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="">Select a school...</option>
                      {memberships
                        .filter(m => m.role === 'student')
                        .map(m => (
                          <option key={m.id} value={m.school_id}>
                            {m.school_name}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedContext && selectedSchoolId && (
        <div className="mt-8">
          <Button
            onClick={handleSelectIdentity}
            size="lg"
            className="w-full"
          >
            Continue as {selectedContext === 'student' ? 'Student' : 'School Admin'}
          </Button>
        </div>
      )}
    </div>
  );
}

