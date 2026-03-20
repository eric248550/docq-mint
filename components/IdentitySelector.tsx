'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useIdentity } from '@/hooks/useIdentity';
import { authenticatedRequest } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { DBSchoolMembership, DBVerifierMembership } from '@/lib/db/types';
import { GraduationCap, Building2, Shield, Loader2 } from 'lucide-react';

interface UserMembershipsData {
  user: any;
  memberships: (DBSchoolMembership & { school_name: string })[];
  verifierMemberships: (DBVerifierMembership & { verifier_name: string })[];
}

export function IdentitySelector() {
  const router = useRouter();
  const { user, getAuthToken, setIdentityContext } = useAuthStore();
  const { selectIdentity } = useIdentity();
  const [memberships, setMemberships] = useState<(DBSchoolMembership & { school_name: string })[]>([]);
  const [verifierMemberships, setVerifierMemberships] = useState<(DBVerifierMembership & { verifier_name: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContext, setSelectedContext] = useState<'student' | 'school_admin' | 'verifier' | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [selectedVerifierId, setSelectedVerifierId] = useState<string | null>(null);

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
          setVerifierMemberships(response.data.verifierMemberships || []);
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
    if (!selectedContext) return;
    if (selectedContext === 'verifier' && !selectedVerifierId) return;
    if ((selectedContext === 'school_admin' || selectedContext === 'student') && !selectedSchoolId) return;

    try {
      if (selectedContext === 'verifier') {
        setIdentityContext('verifier', undefined, selectedVerifierId || undefined);
        router.push('/dashboard');
      } else {
        await selectIdentity(selectedContext, selectedSchoolId || undefined);
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Failed to select identity:', error);
    }
  };

  const hasAdminRole = memberships.some(m => ['owner', 'admin'].includes(m.role));
  const hasStudentRole = memberships.some(m => m.role === 'student');
  const hasVerifierRole = verifierMemberships.length > 0;
  const hasAnyMembership = memberships.length > 0 || verifierMemberships.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const canContinue = selectedContext && (
    (selectedContext === 'verifier' && selectedVerifierId) ||
    ((selectedContext === 'school_admin' || selectedContext === 'student') && selectedSchoolId)
  );

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-2">
        {!hasAnyMembership ? 'Welcome to DOCQ-Mint' : 'Select Your Role'}
      </h2>
      <p className="text-muted-foreground mb-8">
        {!hasAnyMembership
          ? "You don't have any organizations yet. Create one or wait for an invite."
          : 'Choose how you want to access DOCQ-Mint'}
      </p>

      {/* Create organization buttons */}
      <div className="mb-6 flex gap-3">
        {/* Hide create school org button */}
        {/* <Button
          variant={!hasAnyMembership ? 'default' : 'outline'}
          onClick={() => router.push('/schools/create')}
          className="flex-1"
        >
          <Building2 className="mr-2 h-4 w-4" />
          Create School Org
        </Button> */}
        <Button
          variant="outline"
          onClick={() => router.push('/verifiers/create')}
          className="flex-1"
        >
          <Shield className="mr-2 h-4 w-4" />
          Create Verifier Org
        </Button>
      </div>

      {!hasAnyMembership ? (
        <p className="text-sm text-muted-foreground text-center">
          Or wait for an administrator to invite you as a member or user.
        </p>
      ) : (
        <>
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
                    <h3 className="text-xl font-semibold mb-2">Organization Administrator</h3>
                    <p className="text-muted-foreground mb-4">
                      Manage organizations, upload documents, and invite users
                    </p>
                    {selectedContext === 'school_admin' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Select Organization:</label>
                        <select
                          value={selectedSchoolId || ''}
                          onChange={(e) => setSelectedSchoolId(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md bg-background"
                        >
                          <option value="">Select an organization...</option>
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
                        <label className="text-sm font-medium">Select Organization:</label>
                        <select
                          value={selectedSchoolId || ''}
                          onChange={(e) => setSelectedSchoolId(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md bg-background"
                        >
                          <option value="">Select an organization...</option>
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

            {/* Verifier Option */}
            {hasVerifierRole && (
              <div
                onClick={() => setSelectedContext('verifier')}
                className={`border rounded-lg p-6 cursor-pointer transition-all ${
                  selectedContext === 'verifier'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">Verifier Organization</h3>
                    <p className="text-muted-foreground mb-4">
                      Verify documents on behalf of your organization
                    </p>
                    {selectedContext === 'verifier' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Select Verifier Org:</label>
                        <select
                          value={selectedVerifierId || ''}
                          onChange={(e) => setSelectedVerifierId(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md bg-background"
                        >
                          <option value="">Select a verifier org...</option>
                          {verifierMemberships.map(m => (
                            <option key={m.id} value={m.verifier_id}>
                              {m.verifier_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {canContinue && (
            <div className="mt-8">
              <Button
                onClick={handleSelectIdentity}
                size="lg"
                className="w-full"
              >
                Continue as {
                  selectedContext === 'student' ? 'User' :
                  selectedContext === 'verifier' ? 'Verifier' :
                  'Organization Admin'
                }
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
