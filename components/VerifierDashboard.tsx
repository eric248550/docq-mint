'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useVerifiers, useVerifierMembers } from '@/hooks/useVerifiers';
import { authenticatedRequest } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Users, Plus, Trash2, Shield, History } from 'lucide-react';
import { DBVerifier, DBPayment, DBVerificationAccess } from '@/lib/db/types';
import { MemberFilters } from '@/hooks/useSchools';

type AccessRecord = DBVerificationAccess & { token: string; original_filename: string | null; document_type: string };

export function VerifierDashboard() {
  const router = useRouter();
  const { selectedVerifierId, setIdentityContext, identityContext, getAuthToken } = useAuthStore();
  const { verifiers, isLoading: verifiersLoading } = useVerifiers();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedVerifier, setSelectedVerifier] = useState<DBVerifier | null>(null);
  const [historyPayments, setHistoryPayments] = useState<DBPayment[]>([]);
  const [historyAccessRecords, setHistoryAccessRecords] = useState<AccessRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const { members, pagination, isLoading: membersLoading, refetch: refetchMembers, inviteMember, removeMember } = useVerifierMembers(selectedVerifier?.id || null);

  const [memberFilters, setMemberFilters] = useState<MemberFilters>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (verifiers.length > 0) {
      const match = selectedVerifierId
        ? verifiers.find(v => v.id === selectedVerifierId)
        : null;
      setSelectedVerifier(match || verifiers[0]);
    }
  }, [verifiers, selectedVerifierId]);

  useEffect(() => {
    if (selectedVerifier) {
      refetchMembers(memberFilters);
    }
  }, [selectedVerifier, memberFilters]);

  const fetchHistory = async () => {
    if (!selectedVerifier) return;
    setHistoryLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await authenticatedRequest<{ payments: DBPayment[]; accessRecords: AccessRecord[] }>(
        `/api/verifiers/${selectedVerifier.id}/history`,
        token
      );
      if (res.data) {
        setHistoryPayments(res.data.payments);
        setHistoryAccessRecords(res.data.accessRecords);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history' && selectedVerifier) {
      fetchHistory();
    }
  }, [activeTab, selectedVerifier]);

  const handleSelectVerifier = (verifierId: string) => {
    const v = verifiers.find(v => v.id === verifierId);
    if (v) {
      setSelectedVerifier(v);
      setIdentityContext('verifier', undefined, verifierId);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      await inviteMember({ email: inviteEmail.trim(), role: inviteRole });
      setInviteSuccess(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  if (verifiersLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (verifiers.length === 0) {
    return (
      <div className="text-center p-12 border rounded-lg">
        <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-xl font-semibold mb-2">No Verifier Organizations</h3>
        <p className="text-muted-foreground mb-6">
          Create a verifier organization to start verifying documents
        </p>
        <Button onClick={() => router.push('/verifiers/create')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Verifier Organization
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Verifier selector */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <select
            value={selectedVerifier?.id || ''}
            onChange={(e) => handleSelectVerifier(e.target.value)}
            className="w-full max-w-sm px-3 py-2 border rounded-md bg-background"
          >
            {verifiers.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <Button variant="outline" onClick={() => router.push('/verifiers/create')}>
          <Plus className="h-4 w-4 mr-2" />
          New Verifier Org
        </Button>
      </div>

      {selectedVerifier && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-sm grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-2">{selectedVerifier.name}</h2>
              <p className="text-sm text-muted-foreground">ID: {selectedVerifier.id}</p>
              <p className="text-sm text-muted-foreground">
                Created: {new Date(selectedVerifier.created_at).toLocaleDateString()}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {historyLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Payments</h3>
                  {historyPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payments yet.</p>
                  ) : (
                    <div className="divide-y">
                      {historyPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between py-3">
                          <div>
                            <p className="font-medium">
                              {p.currency.toUpperCase()} {Number(p.amount).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(p.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            p.status === 'succeeded'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {p.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Documents Verified</h3>
                  {historyAccessRecords.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No verified documents yet.</p>
                  ) : (
                    <div className="divide-y">
                      {historyAccessRecords.map(r => (
                        <div key={r.id} className="flex items-center justify-between py-3">
                          <div>
                            <p className="font-medium">
                              {r.original_filename || r.document_type}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {r.document_type} &bull; {new Date(r.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <a
                            href={`/verify?token=${r.token}&verifierId=${selectedVerifier.id}`}
                            className="text-xs text-primary underline"
                          >
                            Re-open
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-6">
            {/* Invite form */}
            <div className="border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Invite Member</h3>
              <form onSubmit={handleInvite} className="flex gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email address"
                  className="flex-1 px-3 py-2 border rounded-md"
                  required
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
                <Button type="submit" disabled={isInviting}>
                  {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Invite'}
                </Button>
              </form>
              {inviteError && <p className="mt-2 text-sm text-destructive">{inviteError}</p>}
              {inviteSuccess && <p className="mt-2 text-sm text-green-600">{inviteSuccess}</p>}
            </div>

            {/* Filters */}
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search by email..."
                value={memberFilters.search || ''}
                onChange={(e) => setMemberFilters({ ...memberFilters, search: e.target.value, page: 1 })}
                className="flex-1 px-3 py-2 border rounded-md"
              />
              <select
                value={memberFilters.role || ''}
                onChange={(e) => setMemberFilters({ ...memberFilters, role: e.target.value || undefined, page: 1 })}
                className="px-3 py-2 border rounded-md bg-background"
              >
                <option value="">All Roles</option>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            {/* Members list */}
            {membersLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {members.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-2" />
                    <p>No members found</p>
                  </div>
                ) : (
                  members.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium">
                          {member.email || member.invite_email || 'Unknown'}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 bg-primary/10 rounded-full">
                            {member.role}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            member.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {member.status}
                          </span>
                        </div>
                      </div>
                      {member.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(member.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setMemberFilters({ ...memberFilters, page: pagination.page - 1 })}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setMemberFilters({ ...memberFilters, page: pagination.page + 1 })}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
