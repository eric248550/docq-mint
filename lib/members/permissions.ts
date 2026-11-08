export interface MemberRef {
  role: string;
  user_id: string | null;
}

export interface MemberRuleError {
  error: string;
  status: 400 | 403;
}

const FORBIDDEN_OWNER: MemberRuleError = { error: 'Only owners can manage owners', status: 403 };
const FORBIDDEN_ADMIN: MemberRuleError = { error: 'Only owners can manage admins', status: 403 };
const LAST_OWNER: MemberRuleError = { error: 'Cannot remove the last owner', status: 400 };

/**
 * Rules shared by school and verifier memberships:
 * - Owners can manage everyone.
 * - Admins can manage members below admin, and cannot grant owner.
 * - Nobody can change their own role or status.
 * - An organization always keeps at least one owner.
 * - PATCH can only remove a member. Invites activate through /api/invite/accept.
 */
export function getMemberUpdateError(params: {
  actor: MemberRef;
  target: MemberRef;
  nextRole?: string;
  nextStatus?: string;
  activeOwnerCount: number;
}): MemberRuleError | null {
  const { actor, target, nextRole, nextStatus, activeOwnerCount } = params;

  if (target.user_id !== null && target.user_id === actor.user_id) {
    return { error: 'You cannot change your own membership', status: 403 };
  }
  if (nextStatus && nextStatus !== 'removed') {
    return { error: 'Invalid status', status: 400 };
  }
  if (actor.role !== 'owner') {
    if (target.role === 'owner' || nextRole === 'owner') return FORBIDDEN_OWNER;
    if (target.role === 'admin') return FORBIDDEN_ADMIN;
  }

  const losesOwner = target.role === 'owner' && ((nextRole && nextRole !== 'owner') || nextStatus === 'removed');
  if (losesOwner && activeOwnerCount <= 1) return LAST_OWNER;

  return null;
}

/** Members can always leave on their own, except the last owner. */
export function getMemberRemovalError(params: {
  actor: MemberRef;
  target: MemberRef;
  activeOwnerCount: number;
}): MemberRuleError | null {
  const { actor, target, activeOwnerCount } = params;
  const isSelf = target.user_id !== null && target.user_id === actor.user_id;

  if (actor.role !== 'owner' && !isSelf) {
    if (target.role === 'owner') return FORBIDDEN_OWNER;
    if (target.role === 'admin') return FORBIDDEN_ADMIN;
  }
  if (target.role === 'owner' && activeOwnerCount <= 1) return LAST_OWNER;

  return null;
}
