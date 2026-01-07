import { NextRequest } from 'next/server';

/**
 * Extract Firebase token from Authorization header
 */
export function extractFirebaseToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * For MVP: Simple token validation
 * In production, you'd verify with Firebase Admin SDK
 */
export async function verifyFirebaseToken(token: string): Promise<{ uid: string; email?: string } | null> {
  // MVP: We trust the client-side Firebase auth
  // The token is just passed through for user identification
  // In production, use Firebase Admin SDK to verify:
  // const decodedToken = await admin.auth().verifyIdToken(token);
  
  try {
    // For MVP, decode the JWT payload without verification
    // This is NOT secure for production
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    return {
      uid: payload.user_id || payload.sub,
      email: payload.email,
    };
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
}

