'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSchoolMembers } from '@/hooks/useSchools';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Loader2, Trash2, Search, ArrowUpDown } from 'lucide-react';
import { Modal, useModal } from '@/components/ui/alert-modal';

interface MembersListProps {
  schoolId: string;
  limit?: number;
}

export function MembersList({ schoolId, limit }: MembersListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Filter state – initialised from URL only in full view (namespaced with 'm' prefix)
  const [page, setPage] = useState(!limit ? (Number(searchParams.get('mPage')) || 1) : 1);
  const [searchInput, setSearchInput] = useState(!limit ? (searchParams.get('mSearch') || '') : '');
  const [search, setSearch] = useState(!limit ? (searchParams.get('mSearch') || '') : '');
  const [role, setRole] = useState(!limit ? (searchParams.get('mRole') || '') : '');
  const [sortOrder, setSortOrder] = useState(!limit ? (searchParams.get('mSort') || 'desc') : 'desc');

  const { members, pagination, isLoading, error, refetch, inviteMember, removeMember } = useSchoolMembers(schoolId);
  const { modal, showAlert, showConfirm, closeModal } = useModal();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('student');
  const [isInviting, setIsInviting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch members (preview: once on mount; full: on every filter change)
  useEffect(() => {
    if (limit) {
      refetch({ limit });
    }
  }, [schoolId, limit]);

  useEffect(() => {
    if (limit) return;
    refetch({ page, search, role, sortOrder });
  }, [page, search, role, sortOrder, schoolId]);

  // Sync filters to URL in full view (wrapped in startTransition so the URL
  // update is non-blocking and never interrupts an active search input)
  useEffect(() => {
    if (limit) return;
    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) params.set('mPage', String(page)); else params.delete('mPage');
    if (search) params.set('mSearch', search); else params.delete('mSearch');
    if (role) params.set('mRole', role); else params.delete('mRole');
    if (sortOrder !== 'desc') params.set('mSort', sortOrder); else params.delete('mSort');
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    });
  }, [page, search, role, sortOrder, limit]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);

    try {
      await inviteMember({
        email: inviteEmail || undefined,
        role: inviteRole,
      });
      setShowInviteForm(false);
      setInviteEmail('');
      setInviteRole('student');
      // Refetch current view
      if (limit) {
        refetch({ limit });
      } else {
        refetch({ page, search, role, sortOrder });
      }
    } catch (error) {
      console.error('Failed to invite member:', error);
      await showAlert('Failed to invite member');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    const confirmed = await showConfirm('Are you sure you want to remove this member?');
    if (!confirmed) return;

    try {
      await removeMember(memberId);
    } catch (error) {
      console.error('Failed to remove member:', error);
      await showAlert('Failed to remove member');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-500">
        <p>Error loading members: {error}</p>
      </div>
    );
  }

  const total = pagination?.total ?? members.length;

  return (
    <div className="space-y-4">
      <Modal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        onConfirm={() => closeModal(true)}
        onCancel={() => closeModal(false)}
      />
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Members ({limit ? total : (pagination ? `${total} total` : members.length)})
        </h3>
        {!limit && (
          <Button onClick={() => setShowInviteForm(!showInviteForm)} size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Filter controls – full view only */}
      {!limit && (
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by email..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border rounded-md bg-background"
            />
          </div>
          <select
            value={role}
            onChange={e => { setRole(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border rounded-md bg-background"
          >
            <option value="">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
            <option value="student">Student</option>
            <option value="parent">Parent</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSortOrder(s => s === 'desc' ? 'asc' : 'desc'); setPage(1); }}
            className="flex items-center gap-1"
          >
            <ArrowUpDown className="h-3 w-3" />
            {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
          </Button>
        </div>
      )}

      {showInviteForm && (
        <form onSubmit={handleInvite} className="border rounded-lg p-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="student@example.com"
              className="w-full mt-1 px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
            >
              <option value="student">Student</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
              <option value="parent">Parent</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isInviting}>
              {isInviting ? 'Inviting...' : 'Send Invitation'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowInviteForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {members.length === 0 ? (
        <div className="text-center p-8 border rounded-lg">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No members found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(limit ? members.slice(0, limit) : members).map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:border-primary/50 transition-colors"
            >
              <div className="flex-1">
                <p className="font-medium">
                  {member.email || member.invite_email || 'Unnamed member'}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="capitalize">{member.role}</span>
                  <span>•</span>
                  <span className="capitalize">{member.status}</span>
                </div>
              </div>
              {!limit && member.role !== 'owner' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(member.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* "and X more" in preview mode */}
      {limit && pagination && pagination.total > limit && (
        <p className="text-sm text-center text-muted-foreground">
          and {pagination.total - limit} more...
        </p>
      )}

      {/* Pagination in full view */}
      {!limit && pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
