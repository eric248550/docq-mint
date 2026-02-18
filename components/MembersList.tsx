'use client';

import { useState } from 'react';
import { useSchoolMembers } from '@/hooks/useSchools';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Loader2, Trash2 } from 'lucide-react';
import { DBSchoolMembership } from '@/lib/db/types';

interface MembersListProps {
  schoolId: string;
  limit?: number;
}

export function MembersList({ schoolId, limit }: MembersListProps) {
  const { members, isLoading, error, inviteMember, removeMember } = useSchoolMembers(schoolId);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('student');
  const [isInviting, setIsInviting] = useState(false);

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
    } catch (error) {
      console.error('Failed to invite member:', error);
      alert('Failed to invite member');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      await removeMember(memberId);
    } catch (error) {
      console.error('Failed to remove member:', error);
      alert('Failed to remove member');
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

  const displayMembers = limit ? members.slice(0, limit) : members;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Members ({members.length})</h3>
        {!limit && (
          <Button onClick={() => setShowInviteForm(!showInviteForm)} size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

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

      {displayMembers.length === 0 ? (
        <div className="text-center p-8 border rounded-lg">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No members yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayMembers.map((member) => (
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

      {limit && members.length > limit && (
        <p className="text-sm text-center text-muted-foreground">
          and {members.length - limit} more...
        </p>
      )}
    </div>
  );
}

