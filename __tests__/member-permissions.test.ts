import { getMemberRemovalError, getMemberUpdateError } from '@/lib/members/permissions';

const owner = { role: 'owner', user_id: 'owner-1' };
const otherOwner = { role: 'owner', user_id: 'owner-2' };
const admin = { role: 'admin', user_id: 'admin-1' };
const otherAdmin = { role: 'admin', user_id: 'admin-2' };
const viewer = { role: 'viewer', user_id: 'viewer-1' };

describe('getMemberUpdateError', () => {
  it('lets owners manage admins and grant owner', () => {
    expect(getMemberUpdateError({ actor: owner, target: admin, nextRole: 'owner', activeOwnerCount: 1 })).toBeNull();
  });

  it('stops an admin promoting themselves', () => {
    expect(getMemberUpdateError({ actor: admin, target: admin, nextRole: 'owner', activeOwnerCount: 1 })?.status).toBe(403);
  });

  it('stops admins granting owner or changing owners and admins', () => {
    expect(getMemberUpdateError({ actor: admin, target: viewer, nextRole: 'owner', activeOwnerCount: 1 })?.status).toBe(403);
    expect(getMemberUpdateError({ actor: admin, target: owner, nextRole: 'viewer', activeOwnerCount: 2 })?.status).toBe(403);
    expect(getMemberUpdateError({ actor: admin, target: otherAdmin, nextRole: 'viewer', activeOwnerCount: 1 })?.status).toBe(403);
  });

  it('lets admins manage members below admin', () => {
    expect(getMemberUpdateError({ actor: admin, target: viewer, nextRole: 'student', activeOwnerCount: 1 })).toBeNull();
  });

  it('rejects activating a membership through PATCH', () => {
    expect(getMemberUpdateError({ actor: owner, target: viewer, nextStatus: 'active', activeOwnerCount: 1 })?.status).toBe(400);
  });

  it('keeps the last owner', () => {
    expect(getMemberUpdateError({ actor: otherOwner, target: owner, nextRole: 'admin', activeOwnerCount: 1 })?.status).toBe(400);
    expect(getMemberUpdateError({ actor: otherOwner, target: owner, nextRole: 'admin', activeOwnerCount: 2 })).toBeNull();
  });
});

describe('getMemberRemovalError', () => {
  it('stops admins removing owners and other admins', () => {
    expect(getMemberRemovalError({ actor: admin, target: owner, activeOwnerCount: 2 })?.status).toBe(403);
    expect(getMemberRemovalError({ actor: admin, target: otherAdmin, activeOwnerCount: 1 })?.status).toBe(403);
  });

  it('lets a member leave, except the last owner', () => {
    expect(getMemberRemovalError({ actor: admin, target: admin, activeOwnerCount: 1 })).toBeNull();
    expect(getMemberRemovalError({ actor: owner, target: owner, activeOwnerCount: 1 })?.status).toBe(400);
  });
});
