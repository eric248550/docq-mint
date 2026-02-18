import jwt from 'jsonwebtoken';

export interface InviteTokenPayload {
  schoolId: string;
  email: string;
  role: string;
  type: 'invite';
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
}

export function generateInviteToken(payload: Omit<InviteTokenPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'invite' }, getSecret(), { expiresIn: '7d' });
}

export function verifyInviteToken(token: string): InviteTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as InviteTokenPayload;
    if (decoded.type !== 'invite') return null;
    return decoded;
  } catch {
    return null;
  }
}
